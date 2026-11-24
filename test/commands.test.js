import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { loadCommands } from '../src/loader.js';
import { GAME_DEFS } from '../src/games/index.js';
import { PARTY_PLAYLISTS } from '../src/party.js';
import { PERMISSION_TOTAL, SCOPES, inviteUrl } from '../src/permissions.js';
import { THEMES } from '../src/meta.js';
import { config } from '../src/config.js';
import { INVITE, memoryStore, fake } from '../test-support/helpers.js';

const commands = await loadCommands(fileURLToPath(new URL('../src/commands/', import.meta.url)));

const embedOf = (reply) => reply.embeds[0].data;

async function run(name, { store = memoryStore(), invite = INVITE, service = {}, ...options } = {}) {
  const rig = fake(options);
  await commands.get(name).run({
    interaction: rig.interaction,
    store,
    invite,
    service: { startGame: async () => {}, ...service },
    log: () => {}
  });
  return rig;
}

test('all twenty-one commands load with valid names, descriptions and options', () => {
  const expected = [
    'badges',
    'bluff',
    'chain',
    'daily',
    'debug',
    'duel',
    'help',
    'impostor',
    'invite',
    'mostlikely',
    'number',
    'party',
    'profile',
    'scatter',
    'setup',
    'shop',
    'stats',
    'theme',
    'top',
    'trivia',
    'wyr'
  ];

  assert.deepEqual([...commands.keys()].sort(), expected);
  assert.deepEqual(
    Object.keys(GAME_DEFS).sort(),
    expected.filter((name) => GAME_DEFS[name])
  );

  for (const [name, command] of commands) {
    const data = command.data.toJSON();
    assert.equal(data.name, name);
    assert.match(data.name, /^[a-z0-9-]{1,32}$/);
    assert.ok(data.description.length > 0 && data.description.length <= 100, `${name} description length`);
    assert.equal(typeof command.run, 'function');

    for (const option of data.options ?? []) {
      assert.ok(option.description.length <= 100, `${name} option description`);
      assert.match(option.name, /^[a-z0-9-]{1,32}$/);
      for (const choice of option.choices ?? []) {
        assert.ok(choice.name.length <= 100, `${name} choice name`);
        assert.ok(choice.value.length <= 100, `${name} choice value`);
      }
    }
  }
});

test('every game command hands a clean request to the service', async () => {
  const calls = [];
  const service = { startGame: async (args) => calls.push(args) };

  for (const kind of Object.keys(GAME_DEFS)) {
    await run(kind, { service, integers: { rounds: 2 } });
    assert.equal(calls.at(-1).kind, kind);
    if (kind === 'duel') {
      assert.equal(calls.at(-1).rounds, undefined, 'duel is always first to two rounds');
      const options = commands.get('duel').data.toJSON().options ?? [];
      assert.equal(options.some((option) => option.name === 'rounds'), false);
    } else {
      assert.equal(calls.at(-1).rounds, 2);
    }
  }

  await run('bluff', { service, strings: { pack: 'food' } });
  assert.equal(calls.at(-1).pack, 'food');

  await run('trivia', { service });
  assert.equal(calls.at(-1).rounds, undefined, 'the guild default is resolved by the service, not the command');

  await run('party', { service, strings: { playlist: 'chaos' }, integers: { rounds: 3 } });
  const party = calls.at(-1);
  assert.equal(party.kind, 'party');
  assert.equal(party.playlist, 'chaos');
  assert.equal(party.rounds, 3);

  await run('party', { service });
  assert.equal(calls.at(-1).playlist, 'classic', 'the default party is the classic lineup');
  assert.ok(Object.keys(PARTY_PLAYLISTS).includes('classic'));
});

test('/help lists all nine games, the party and the invite', async () => {
  const rig = await run('help');
  assert.equal(rig.replies.length, 1);

  const payload = rig.replies[0];
  const embed = embedOf(payload);
  const text = JSON.stringify(embed);

  for (const kind of Object.keys(GAME_DEFS)) assert.ok(text.includes(`/${kind}`), `help mentions /${kind}`);
  assert.match(embed.description, /nine games/);
  assert.match(text, /\/party/);
  assert.ok(embed.fields.length >= 4);
  assert.ok(embed.description.length <= 4_096);
  for (const field of embed.fields) assert.ok(field.value.length <= 1_024);

  assert.equal(payload.components.at(-1).components[0].data.url, INVITE);
});

test('/invite states the exact permissions, scopes and integer', async () => {
  const rig = await run('invite');
  const embed = embedOf(rig.replies[0]);
  const text = JSON.stringify(embed);

  assert.equal(PERMISSION_TOTAL, 274877926400n);
  assert.deepEqual(SCOPES, ['bot', 'applications.commands']);
  assert.match(text, /274877926400/);
  assert.match(text, /bot applications\.commands/);
  assert.match(text, /View Channels/);
  assert.match(text, /Send Messages in Threads/);
  assert.match(text, /no administrator/);
  assert.equal(rig.replies[0].components.at(-1).components[0].data.url, INVITE);

  assert.match(inviteUrl('123'), /client_id=123/);
  assert.match(inviteUrl('123'), /permissions=274877926400/);

  const withoutId = await run('invite', { invite: null });
  assert.match(embedOf(withoutId.replies[0]).description, /no invite link/);
});

test('/profile and /stats explain an empty record without a crash', async () => {
  const profile = await run('profile');
  assert.match(embedOf(profile.replies[0]).title, /u1/);
  assert.match(JSON.stringify(embedOf(profile.replies[0])), /no finished games|clean slate/);

  const stats = await run('stats');
  assert.match(embedOf(stats.replies[0]).description, /no finished games/);
});

test('/stats and /profile show a real record', async () => {
  const store = memoryStore();
  await store.updateUser('g1', 'u1', (entry) => {
    Object.assign(entry, {
      name: 'sam',
      games: 4,
      wins: 2,
      rounds: 12,
      found: 5,
      fooled: 9,
      best: 3,
      correct: 7,
      answers: 10,
      xp: 150,
      coins: 90,
      kinds: ['bluff', 'trivia']
    });
  });

  const stats = await run('stats', { store });
  const embed = embedOf(stats.replies[0]);
  assert.match(embed.description, /4 games · 2 wins · 50% win rate/);
  assert.match(embed.fields[0].value, /9 people fooled/);
  assert.match(embed.fields[1].value, /5 truths found/);
  assert.match(embed.fields[2].value, /bluff, trivia/);

  const profile = await run('profile', {
    store,
    user: { id: 'u1', username: 'sam', globalName: 'sam', bot: false }
  });
  const card = embedOf(profile.replies[0]);
  assert.match(card.title, /sam/);
  assert.match(JSON.stringify(card), /90/);
  assert.match(JSON.stringify(card), /0\/28 badges|28 badges/);
});

test('/top handles an empty board and ranks by the requested metric', async () => {
  const empty = await run('top');
  assert.match(embedOf(empty.replies[0]).description, /no finished games/);

  const store = memoryStore();
  for (const [id, name, fooled, wins] of [
    ['a', 'alex', 12, 1],
    ['b', 'sam', 4, 2]
  ]) {
    await store.updateUser('g1', id, (entry) => {
      Object.assign(entry, { name, fooled, wins, games: 3 });
    });
  }

  const top = await run('top', { store, strings: { metric: 'fooled' } });
  const embed = embedOf(top.replies[0]);
  assert.match(embed.title, /people fooled/);
  assert.match(embed.description, /alex/);
  assert.match(embed.description, /12 fooled/);

  const byWins = await run('top', { store });
  assert.match(byWins.replies[0].embeds[0].data.description, /sam/);
});

test('/shop and /theme sell cosmetic colours only', async () => {
  const store = memoryStore();
  await store.updateUser('g1', 'u1', (entry) => {
    entry.coins = 500;
    entry.name = 'sam';
  });

  const shop = await run('shop', { store });
  const shopText = JSON.stringify(embedOf(shop.replies[0]));
  assert.match(shopText, /cosmetic only/);
  for (const theme of THEMES) assert.ok(shopText.includes(theme.name), `${theme.name} is listed`);

  const list = await run('theme', { store });
  assert.match(embedOf(list.replies[0]).title, /your themes/);

  const bought = await run('theme', { store, strings: { id: 'mint' } });
  assert.match(embedOf(bought.replies[0]).title, /Mint · equipped/);
  assert.equal(store.get('g1', 'u1').coins, 250);

  const again = await run('theme', { store, strings: { id: 'mint' } });
  assert.match(embedOf(again.replies[0]).description, /equipped\./);
  assert.equal(store.get('g1', 'u1').coins, 250, 'equipping again is free');

  await store.updateUser('g1', 'u1', (entry) => {
    entry.coins = 0;
  });
  const poor = await run('theme', { store, strings: { id: 'ocean' } });
  assert.match(embedOf(poor.replies[0]).title, /not enough coins/);
});

test('/badges lists earned and locked badges', async () => {
  const store = memoryStore();
  const empty = await run('badges', { store });
  const first = embedOf(empty.replies[0]);
  assert.match(first.title, /badges/);
  assert.match(JSON.stringify(first), /28/);

  await store.updateUser('g1', 'u1', (entry) => {
    entry.badges = ['first-game', 'first-win'];
  });
  const some = await run('badges', { store });
  const text = JSON.stringify(embedOf(some.replies[0]));
  assert.match(text, /First Timer/);
  assert.match(text, /2 of 28 earned/);
});

test('/daily pays once and then reports the streak', async () => {
  const store = memoryStore();

  const first = await run('daily', { store });
  assert.match(embedOf(first.replies[0]).title, /daily coins/);
  assert.match(embedOf(first.replies[0]).description, /\+30 coins/);
  assert.ok(first.replies[0].flags);
  assert.ok(store.get('g1', 'u1').coins >= 30);

  const second = await run('daily', { store });
  assert.match(embedOf(second.replies[0]).title, /already claimed/);
});

test('/setup is optional, gated and resets cleanly', async () => {
  const store = memoryStore();
  const denied = await run('setup', { store, memberPermissions: { has: () => false } });
  assert.match(denied.replies[0].content, /Manage Server/);
  assert.equal(store.guildSettings('g1').rounds, null);

  const allowed = await run('setup', {
    store,
    memberPermissions: { has: () => true },
    integers: { rounds: 4 },
    strings: { pace: 'relaxed' }
  });
  assert.match(embedOf(allowed.replies[0]).description, /every game opens with four rounds|rounds · \*\*4/);
  assert.deepEqual(store.guildSettings('g1'), { rounds: 4, pace: 'relaxed' });

  const reset = await run('setup', {
    store,
    memberPermissions: { has: () => true },
    booleans: { reset: true }
  });
  assert.match(JSON.stringify(embedOf(reset.replies[0])), /each game decides/);
  assert.deepEqual(store.guildSettings('g1'), { rounds: null, pace: 'standard' });
});

test('/debug is reserved for the configured owner', async () => {
  const rig = await run('debug');
  if (config.ownerId) {
    assert.ok(rig.replies.length === 1);
  } else {
    assert.match(rig.replies[0].content, /reserved for the bot owner/);
  }
});
