import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const VERSION = 2;
const DM = 'dm';

export const DEFAULT_SETTINGS = { rounds: null, pace: 'standard' };

const blank = () => ({ version: VERSION, users: {}, guilds: {} });

export const blankUser = (name = 'player') => ({
  userId: null,
  guildId: null,
  name,
  xp: 0,
  coins: 0,
  games: 0,
  wins: 0,
  rounds: 0,
  found: 0,
  fooled: 0,
  best: 0,
  correct: 0,
  answers: 0,
  streak: 0,
  lastDaily: '',
  theme: 'default',
  badges: [],
  kinds: [],
  counters: {},
  lastPlayed: 0
});

const int = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0);
const list = (value, max = 64) =>
  Array.isArray(value) ? [...new Set(value.filter((entry) => typeof entry === 'string' && entry).map((entry) => entry.slice(0, 40)))].slice(0, max) : [];

const counterMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof key !== 'string' || key.length > 32) continue;
    out[key] = int(raw);
  }
  return out;
};

const hydrate = (raw = {}, fallbackGuild = DM) => {
  const base = blankUser(raw.name);
  const guildId = typeof raw.guildId === 'string' && raw.guildId ? raw.guildId : fallbackGuild;

  return {
    ...base,
    userId: typeof raw.userId === 'string' ? raw.userId : null,
    guildId,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 32) : base.name,
    xp: int(raw.xp),
    coins: int(raw.coins),
    games: int(raw.games),
    wins: int(raw.wins),
    rounds: int(raw.rounds),
    found: int(raw.found),
    fooled: int(raw.fooled),
    best: int(raw.best),
    correct: int(raw.correct),
    answers: int(raw.answers),
    streak: int(raw.streak),
    lastDaily: typeof raw.lastDaily === 'string' ? raw.lastDaily.slice(0, 24) : '',
    theme: typeof raw.theme === 'string' && raw.theme ? raw.theme.slice(0, 24) : 'default',
    badges: list(raw.badges),
    kinds: list(raw.kinds),
    counters: counterMap(raw.counters),
    lastPlayed: int(raw.lastPlayed)
  };
};

const keyFor = (guildId, userId) => `${guildId ?? DM}:${userId}`;

const keyParts = (key) => {
  const at = key.indexOf(':');
  return at > 0 ? { guildId: key.slice(0, at), userId: key.slice(at + 1) } : { guildId: DM, userId: key };
};

/**
 * One JSON file, written atomically, with a one-generation backup. Records are
 * scoped to the server, so a player's history in one server is invisible in
 * another. No database, no accounts, no migrations beyond this file.
 */
export async function openStore({ file, log = () => {} }) {
  let data = blank();
  let pending = Promise.resolve();
  let writes = 0;

  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.users || typeof parsed.users !== 'object') {
      throw new Error('unexpected shape');
    }

    const users = {};
    for (const [key, entry] of Object.entries(parsed.users)) {
      const parts = keyParts(key);
      const guildId = typeof entry?.guildId === 'string' ? entry.guildId : parts.guildId;
      const userId = typeof entry?.userId === 'string' ? entry.userId : parts.userId;
      if (!userId) continue;
      users[keyFor(guildId, userId)] = { ...hydrate(entry, guildId), userId, guildId };
    }

    const guilds = {};
    if (parsed.guilds && typeof parsed.guilds === 'object') {
      for (const [id, raw] of Object.entries(parsed.guilds)) {
        if (!raw || typeof raw !== 'object') continue;
        guilds[id] = {
          rounds:
            raw.rounds === undefined || raw.rounds === null
              ? null
              : Math.min(8, Math.max(1, int(raw.rounds))),
          pace: ['fast', 'standard', 'relaxed'].includes(raw.pace) ? raw.pace : DEFAULT_SETTINGS.pace
        };
      }
    }

    data = { version: VERSION, users, guilds };
  } catch (err) {
    if (err.code === 'ENOENT') {
      log(`no stats file yet, starting fresh: ${file}`);
    } else {
      const saved = `${file}.corrupt-${Date.now()}`;
      await rename(file, saved).catch(() => {});
      log(`stats file was unreadable (${err.message}); kept a copy at ${saved}`);
    }
  }

  function persist() {
    const run = async () => {
      await mkdir(dirname(file), { recursive: true });
      if (writes > 0) await copyFile(file, `${file}.bak`).catch(() => {});
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      await rename(temp, file);
      writes += 1;
    };

    // If one write fails (disk full, permissions), the queue recovers on the
    // next call instead of rejecting every future save.
    pending = pending.then(run, run);
    return pending;
  }

  function entryFor(guildId, userId, fallbackName) {
    const key = keyFor(guildId, userId);
    const entry = data.users[key] ?? blankUser(fallbackName);
    entry.userId = userId;
    entry.guildId = guildId ?? DM;
    return entry;
  }

  return {
    get file() {
      return file;
    },

    get size() {
      return Object.keys(data.users).length;
    },

    get(guildId, userId) {
      const entry = data.users[keyFor(guildId, userId)];
      return entry ? structuredClone(entry) : blankUser();
    },

    /**
     * Mutate one player and persist. The mutator receives the live entry, so it
     * can read the old total and write the new one in a single pass.
     */
    async updateUser(guildId, userId, mutate, name = 'player') {
      const [entry] = await this.updateUsers(guildId, [{ id: userId, name }], (row) => mutate(row));
      return entry;
    },

    /**
     * Mutate several players and persist once. Returns fresh copies of the
     * entries after the mutation, which is how badges are evaluated.
     */
    async updateUsers(guildId, users, mutate) {
      const now = Date.now();
      const out = [];

      for (const user of users) {
        if (!user?.id) continue;
        const key = keyFor(guildId, user.id);
        // Work on a copy so a throwing mutator cannot leave half-written state.
        const entry = structuredClone(entryFor(guildId, user.id, user.name));

        if (typeof user.name === 'string' && user.name.trim()) entry.name = user.name.trim().slice(0, 32);
        mutate(entry, user);
        entry.lastPlayed = now;

        // Re-hydrate after the mutation so a buggy or hostile mutator cannot
        // write negative totals, giant strings or non-string badges to disk.
        const clean = hydrate(entry, guildId ?? DM);
        clean.userId = entry.userId;
        clean.guildId = entry.guildId;

        data.users[key] = clean;
        out.push(structuredClone(clean));
      }

      await persist();
      return out;
    },

    /** Low-level accumulation, kept for tests and simple imports. */
    async record({ guildId = null, players = [], winnerIds = [], rounds = 0, kind = null } = {}) {
      const winners = new Set(winnerIds);
      await this.updateUsers(guildId, players, (entry, player) => {
        entry.games += 1;
        entry.wins += winners.has(player.id) ? 1 : 0;
        entry.rounds += int(rounds);
        entry.found += int(player.found);
        entry.fooled += int(player.fooled);
        entry.best = Math.max(entry.best, int(player.best));
        entry.correct += int(player.correct);
        entry.answers += int(player.answers);
        if (kind && !entry.kinds.includes(kind)) entry.kinds.push(kind);
      });
      return true;
    },

    top({ guildId = null, metric = 'wins', limit = 10 } = {}) {
      const sorters = {
        wins: (a, b) => b.wins - a.wins || b.xp - a.xp || b.games - a.games,
        fooled: (a, b) => b.fooled - a.fooled || b.wins - a.wins || b.games - a.games,
        xp: (a, b) => b.xp - a.xp || b.wins - a.wins,
        coins: (a, b) => b.coins - a.coins || b.xp - a.xp,
        games: (a, b) => b.games - a.games || b.wins - a.wins,
        correct: (a, b) => b.correct - a.correct || b.wins - a.wins
      };

      return Object.values(data.users)
        .filter((user) => user.guildId === (guildId ?? DM) && user.games > 0)
        .sort(sorters[metric] ?? sorters.wins)
        .slice(0, limit)
        .map((user) => structuredClone(user));
    },

    guildSettings(guildId) {
      const raw = guildId ? data.guilds[guildId] : null;
      return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
    },

    async setGuild(guildId, patch = {}) {
      if (!guildId) return false;
      const current = data.guilds[guildId] ?? { ...DEFAULT_SETTINGS };
      data.guilds[guildId] = {
        rounds:
          patch.rounds === undefined
            ? current.rounds
            : patch.rounds === null
              ? null
              : Math.min(8, Math.max(1, int(patch.rounds))),
        pace: ['fast', 'standard', 'relaxed'].includes(patch.pace) ? patch.pace : current.pace
      };
      await persist();
      return true;
    },

    async flush() {
      await pending;
    }
  };
}
