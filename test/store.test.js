import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openStore, DEFAULT_SETTINGS, blankUser } from '../src/store.js';

const folder = () => mkdtemp(join(tmpdir(), 'baloney-store-'));
const GUILD = 'g1';

test('stats accumulate across games and survive a reopen', async () => {
  const dir = await folder();
  const file = join(dir, 'stats.json');

  const store = await openStore({ file });
  await store.record({
    guildId: GUILD,
    players: [
      { id: 'u1', name: 'sam', score: 3000, found: 2, fooled: 4, best: 3 },
      { id: 'u2', name: 'alex', score: 1000, found: 1, fooled: 1, best: 1 }
    ],
    winnerIds: ['u1'],
    rounds: 3,
    kind: 'bluff'
  });
  await store.record({
    guildId: GUILD,
    players: [{ id: 'u2', name: 'alex', score: 500, found: 1, fooled: 2, best: 2 }],
    winnerIds: ['u2'],
    rounds: 1,
    kind: 'trivia'
  });

  const sam = store.get(GUILD, 'u1');
  assert.equal(sam.games, 1);
  assert.equal(sam.wins, 1);
  assert.equal(sam.rounds, 3);
  assert.equal(sam.fooled, 4);
  assert.equal(sam.best, 3);
  assert.deepEqual(sam.kinds, ['bluff']);

  const alex = store.get(GUILD, 'u2');
  assert.equal(alex.games, 2);
  assert.equal(alex.wins, 1);
  assert.equal(alex.fooled, 3);
  assert.deepEqual(alex.kinds, ['bluff', 'trivia']);

  await store.flush();

  const reopened = await openStore({ file });
  assert.equal(reopened.get(GUILD, 'u1').wins, 1);
  assert.equal(reopened.get(GUILD, 'u2').games, 2);

  const raw = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(raw.version, 2);
  assert.equal(raw.users[`${GUILD}:u1`].name, 'sam');
  assert.equal(raw.users[`${GUILD}:u1`].xp, 0);
});

test('records are scoped to one server', async () => {
  const dir = await folder();
  const store = await openStore({ file: join(dir, 'stats.json') });

  await store.record({
    guildId: 'g1',
    players: [{ id: 'u1', name: 'sam', fooled: 5 }],
    winnerIds: ['u1'],
    rounds: 1
  });

  assert.equal(store.get('g1', 'u1').games, 1);
  assert.equal(store.get('g2', 'u1').games, 0, 'a different server starts clean');
  assert.equal(store.get(null, 'u1').games, 0, 'and so does a DM');
  assert.equal(store.top({ guildId: 'g2' }).length, 0);
});

test('updateUsers writes the whole table once and clamps counters', async () => {
  const dir = await folder();
  const file = join(dir, 'stats.json');
  const store = await openStore({ file });

  const rows = await store.updateUsers(
    GUILD,
    [
      { id: 'u1', name: 'sam' },
      { id: 'u2', name: 'alex' },
      { id: '', name: 'ignored' }
    ],
    (entry) => {
      entry.xp += 100;
      entry.counters.rounds = -4;
      entry.counters['x'.repeat(40)] = 1;
    }
  );

  assert.equal(rows.length, 2, 'the empty id is ignored');
  assert.equal(rows[0].xp, 100);
  assert.equal(rows[0].counters.rounds, 0, 'negative counters clamp to zero');
  assert.equal(Object.keys(rows[0].counters).length, 1, 'absurd counter names are dropped');
  assert.equal(store.get(GUILD, 'u1').name, 'sam');

  const again = await store.updateUser(GUILD, 'u1', (entry) => {
    entry.coins += 5;
  });
  assert.equal(again.coins, 5);
  assert.equal(store.get(GUILD, 'u1').xp, 100, 'the earlier value survived');
});

test('the leaderboard sorts by every metric and skips idle users', async () => {
  const dir = await folder();
  const store = await openStore({ file: join(dir, 'stats.json') });

  await store.record({
    guildId: GUILD,
    players: [
      { id: 'a', name: 'a', found: 0, fooled: 9, correct: 1 },
      { id: 'b', name: 'b', found: 0, fooled: 2, correct: 7 },
      { id: 'c', name: 'c', found: 0, fooled: 5, correct: 3 }
    ],
    winnerIds: ['b'],
    rounds: 1
  });

  await store.updateUser(GUILD, 'c', (entry) => {
    entry.xp = 500;
    entry.coins = 200;
  });

  const ids = (metric) => store.top({ guildId: GUILD, metric }).map((row) => row.userId);

  assert.deepEqual(ids('wins'), ['b', 'c', 'a']);
  assert.deepEqual(ids('fooled'), ['a', 'c', 'b']);
  assert.deepEqual(ids('correct'), ['b', 'c', 'a']);
  assert.deepEqual(ids('xp'), ['c', 'b', 'a']);
  assert.deepEqual(ids('coins'), ['c', 'a', 'b']);
  assert.equal(ids('games').length, 3);
  assert.equal(store.get(GUILD, 'nobody').games, 0);
});

test('guild settings are optional, persist and reset cleanly', async () => {
  const dir = await folder();
  const file = join(dir, 'stats.json');
  const store = await openStore({ file });

  assert.deepEqual(store.guildSettings(GUILD), DEFAULT_SETTINGS);
  assert.equal(store.guildSettings(GUILD).rounds, null, 'games choose their own default rounds');

  await store.setGuild(GUILD, { rounds: 4, pace: 'fast' });
  assert.deepEqual(store.guildSettings(GUILD), { rounds: 4, pace: 'fast' });

  await store.setGuild(GUILD, { pace: 'relaxed' });
  assert.equal(store.guildSettings(GUILD).rounds, 4, 'an omitted field keeps its value');
  assert.equal(store.guildSettings(GUILD).pace, 'relaxed');

  await store.setGuild(GUILD, { rounds: null, pace: 'standard' });
  assert.deepEqual(store.guildSettings(GUILD), DEFAULT_SETTINGS);

  await store.setGuild(GUILD, { rounds: 99, pace: 'nonsense' });
  assert.equal(store.guildSettings(GUILD).rounds, 8, 'rounds clamp to eight');
  assert.equal(store.guildSettings(GUILD).pace, 'standard', 'an unknown pace falls back');

  await store.flush();
  const reopened = await openStore({ file });
  assert.equal(reopened.guildSettings(GUILD).rounds, 8);
});

test('a one-generation backup keeps the previous file', async () => {
  const dir = await folder();
  const file = join(dir, 'stats.json');
  const store = await openStore({ file });

  await store.updateUser(GUILD, 'u1', (entry) => {
    entry.games = 1;
  });
  assert.equal(existsSync(`${file}.bak`), false, 'the first write has nothing to back up');

  await store.updateUser(GUILD, 'u1', (entry) => {
    entry.games = 2;
  });

  assert.equal(existsSync(`${file}.bak`), true);
  const live = JSON.parse(await readFile(file, 'utf8'));
  const backup = JSON.parse(await readFile(`${file}.bak`, 'utf8'));
  assert.equal(live.users[`${GUILD}:u1`].games, 2);
  assert.equal(backup.users[`${GUILD}:u1`].games, 1);
});

test('an unreadable stats file is set aside instead of crashing the bot', async () => {
  const dir = await folder();
  const file = join(dir, 'stats.json');
  await writeFile(file, '{ this is not json', 'utf8');

  const warnings = [];
  const store = await openStore({ file, log: (msg) => warnings.push(msg) });

  assert.equal(store.top().length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /unreadable/);
  assert.equal(existsSync(file), false, 'the broken file is moved, not left to be rewritten');

  const names = await readdir(dir);
  assert.ok(names.some((name) => name.includes('.corrupt-')));

  await store.record({ guildId: GUILD, players: [{ id: 'u1', name: 'sam' }], winnerIds: ['u1'], rounds: 1 });
  await store.flush();
  assert.equal(JSON.parse(await readFile(file, 'utf8')).users[`${GUILD}:u1`].wins, 1);
});

test('a version 1 file is migrated in place without losing records', async () => {
  const dir = await folder();
  const file = join(dir, 'stats.json');
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      users: {
        [`${GUILD}:u1`]: { guildId: GUILD, name: 'sam', games: 4, wins: 2, found: 3, fooled: 6, best: 2, rounds: 9 },
        'u2': { name: 'legacy dm', games: 1, wins: 1 }
      }
    }),
    'utf8'
  );

  const store = await openStore({ file });

  const sam = store.get(GUILD, 'u1');
  assert.equal(sam.games, 4);
  assert.equal(sam.wins, 2);
  assert.equal(sam.xp, 0, 'new fields start at zero');
  assert.equal(sam.coins, 0);
  assert.equal(sam.theme, 'default');
  assert.equal(store.get(null, 'u2').games, 1, 'an unprefixed record lands in a DM');

  await store.updateUser(GUILD, 'u1', (entry) => {
    entry.coins = 10;
  });
  await store.flush();

  const raw = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(raw.version, 2);
  assert.equal(raw.users[`${GUILD}:u1`].coins, 10);
  assert.ok(raw.users['dm:u2'], 'the legacy DM key is rewritten in the new shape');
});

test('unknown fields in the stats file do not leak into players', async () => {
  const dir = await folder();
  const file = join(dir, 'stats.json');
  await writeFile(
    file,
    JSON.stringify({
      version: 2,
      users: {
        [`${GUILD}:u1`]: {
          guildId: GUILD,
          userId: 'u1',
          name: 'sam',
          wins: 1,
          games: 1,
          password: 'hunter2',
          nested: { evil: true },
          badges: ['first-game', 'first-game', 42, ''],
          theme: 'custom-ish'
        }
      }
    }),
    'utf8'
  );

  const store = await openStore({ file });
  const player = store.get(GUILD, 'u1');

  assert.equal(player.wins, 1);
  assert.equal(player.fooled, 0);
  assert.equal(player.best, 0);
  assert.equal(player.password, undefined);
  assert.equal(player.nested, undefined);
  assert.deepEqual(player.badges, ['first-game'], 'badges are strings, unique and deduped');
  assert.equal(player.theme, 'custom-ish', 'an unknown theme is left for the shop to handle');
});

test('blankUser is the single source of truth for a new record', () => {
  const entry = blankUser('sam');
  assert.equal(entry.name, 'sam');
  assert.equal(entry.xp, 0);
  assert.equal(entry.coins, 0);
  assert.deepEqual(entry.badges, []);
  assert.deepEqual(entry.counters, {});
  assert.equal(entry.theme, 'default');
});
