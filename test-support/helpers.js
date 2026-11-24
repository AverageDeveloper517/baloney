import assert from 'node:assert/strict';

import { toPayload } from '../src/ui.js';
import { createGame, GAME_DEFS } from '../src/games/index.js';
import { blankUser } from '../src/store.js';

export const INVITE = 'https://discord.com/oauth2/authorize?client_id=1&scope=bot';
export const CLOCK = 5_000_000;

export const IDS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'];

/**
 * Build a started game directly, without the Discord layer. Extra options are
 * passed straight to the game constructor.
 */
export function table(kind, { players = 3, start = true, clock = () => CLOCK, rng = () => 0.42, ...rest } = {}) {
  const def = GAME_DEFS[kind];
  assert.ok(def, `unknown game ${kind}`);

  const game = createGame(kind, {
    channelId: 'c1',
    guildId: 'g1',
    hostId: 'u1',
    clock,
    rng,
    ...rest
  });

  const ids = IDS.slice(0, Math.min(players, def.max));
  for (const id of ids) game.add({ id, name: `player ${id.slice(1)}` });
  if (start) {
    const result = game.start();
    assert.equal(result.ok, true, `could not start ${kind}: ${result.reason}`);
  }

  return game;
}

/** Check a view model against Discord's real message limits. */
export function assertPayload(view, { invite = null, expectInvite = false } = {}) {
  const payload = toPayload(view, { invite });
  const embed = payload.embeds[0].data;

  assert.ok((embed.title ?? '').length <= 256, 'title fits');
  assert.ok((embed.description ?? '').length <= 4_096, 'description fits');
  assert.ok((embed.footer?.text ?? '').length <= 2_048, 'footer fits');
  assert.ok((embed.fields ?? []).length <= 25, 'field count fits');

  for (const field of embed.fields ?? []) {
    assert.ok(field.name.length <= 256, `field name fits: ${field.name}`);
    assert.ok(field.value.length <= 1_024, `field value fits: ${field.name}`);
  }

  assert.ok(payload.components.length <= 5, 'row count fits');

  for (const row of payload.components) {
    assert.ok(row.components.length <= 5, 'button count per row fits');
    for (const button of row.components) {
      const data = button.data;
      assert.ok((data.label ?? '').length <= 80, 'label fits');
      if (data.custom_id) {
        assert.ok(data.custom_id.length <= 100, 'custom id fits');
        assert.match(data.custom_id, /^[a-z]+:/, 'custom id has a namespace');
      }
    }
  }

  if (expectInvite) {
    const last = payload.components.at(-1)?.components?.[0]?.data;
    assert.equal(last?.url, invite);
  }

  return payload;
}

/**
 * A store with the same surface as the real one, held in memory. Used by the
 * service and meta tests so they never touch the disk.
 */
export function memoryStore() {
  const users = new Map();
  const guilds = new Map();
  const key = (guildId, userId) => `${guildId ?? 'dm'}:${userId}`;

  const store = {
    get size() {
      return users.size;
    },
    file: 'memory',
    get(guildId, userId) {
      const entry = users.get(key(guildId, userId));
      return entry ? structuredClone(entry) : { ...blankUser(), userId, guildId: guildId ?? 'dm' };
    },
    async updateUsers(guildId, list, mutate) {
      const out = [];
      for (const user of list) {
        if (!user?.id) continue;
        const k = key(guildId, user.id);
        const entry = structuredClone(
          users.get(k) ?? { ...blankUser(user.name), userId: user.id, guildId: guildId ?? 'dm' }
        );
        if (typeof user.name === 'string' && user.name.trim()) entry.name = user.name.trim();
        mutate(entry, user);
        entry.lastPlayed = Date.now();
        users.set(k, entry);
        out.push(structuredClone(entry));
      }
      return out;
    },
    async updateUser(guildId, userId, mutate, name) {
      const [entry] = await store.updateUsers(guildId, [{ id: userId, name }], mutate);
      return entry;
    },
    guildSettings(guildId) {
      return { rounds: null, pace: 'standard', ...(guilds.get(guildId) ?? {}) };
    },
    async setGuild(guildId, patch) {
      guilds.set(guildId, { ...store.guildSettings(guildId), ...patch });
      return true;
    },
    top({ guildId = null, metric = 'wins', limit = 10 } = {}) {
      const rows = [...users.values()].filter((entry) => entry.guildId === (guildId ?? 'dm') && entry.games > 0);
      const sorters = {
        wins: (a, b) => b.wins - a.wins || b.xp - a.xp,
        fooled: (a, b) => b.fooled - a.fooled || b.wins - a.wins,
        xp: (a, b) => b.xp - a.xp,
        coins: (a, b) => b.coins - a.coins,
        games: (a, b) => b.games - a.games,
        correct: (a, b) => b.correct - a.correct
      };
      return rows
        .sort(sorters[metric] ?? sorters.wins)
        .slice(0, limit)
        .map((entry) => structuredClone(entry));
    },
    async flush() {}
  };

  return store;
}

/** A fake Discord interaction that records everything a handler does. */
export function fake({
  id = 'u1',
  channelId = 'c1',
  guildId = 'g1',
  customId = null,
  values = {},
  integers = {},
  strings = {},
  booleans = {},
  user = null,
  memberPermissions = null,
  failReply = null
} = {}) {
  const replies = [];
  const edits = [];
  const modalShows = [];
  const followUps = [];
  let deferred = false;

  const message = {
    id: `m-${id}`,
    edit: async (payload) => {
      edits.push(payload);
    }
  };

  const self = {
    id: `i-${id}-${Math.random().toString(36).slice(2, 6)}`,
    user: user ?? {
      id,
      username: id,
      globalName: id,
      bot: false
    },
    member: { displayName: id },
    channelId,
    guildId,
    customId,
    memberPermissions: memberPermissions ?? { has: () => true },
    options: {
      getInteger: (name) => integers[name] ?? null,
      getString: (name) => strings[name] ?? null,
      getBoolean: (name) => booleans[name] ?? null,
      getUser: (name) => (name === 'user' ? user ?? null : null)
    },
    fields: {
      getTextInputValue: (name) => values[name] ?? ''
    },
    reply: async (payload) => {
      if (failReply) throw new Error(failReply);
      replies.push(payload);
      return { resource: { message } };
    },
    followUp: async (payload) => {
      followUps.push(payload);
      return payload;
    },
    editReply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    deferUpdate: async () => {
      deferred = true;
    },
    deferReply: async () => {
      deferred = true;
    },
    fetchReply: async () => message,
    showModal: async (modal) => {
      modalShows.push(modal);
    },
    isRepliable: () => true,
    isButton: () => Boolean(customId) && !customId.startsWith('gm:'),
    isModalSubmit: () => Boolean(customId?.startsWith('gm:')),
    isChatInputCommand: () => false,
    replied: false,
    get deferred() {
      return deferred;
    }
  };

  return {
    interaction: self,
    replies,
    edits,
    modalShows,
    followUps,
    message,
    isDeferred: () => deferred,
    lastReply: () => replies.at(-1),
    lastEdit: () => edits.at(-1)
  };
}

/** A modal submission carrying the same id as an open modal. */
export function modal(fields, { id = 'u1', channelId = 'c1', guildId = 'g1', customId = 'gm:x' } = {}) {
  const rig = fake({ id, channelId, guildId, customId, values: fields });
  return rig;
}
