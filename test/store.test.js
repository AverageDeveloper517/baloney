import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openStore } from '../src/store.js';

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
    rounds: 3
  });
  await store.record({
    guildId: GUILD,
    players: [{ id: 'u2', name: 'alex', score: 500, found: 1, fooled: 2, best: 2 }],
    winnerIds: ['u2'],
    rounds: 1
  });

  const sam = store.get(GUILD, 'u1');
  assert.equal(sam.games, 1);
  assert.equal(sam.wins, 1);
  assert.equal(sam.rounds, 3);
  assert.equal(sam.fooled, 4);
  assert.equal(sam.best, 3);

  const alex = store.get(GUILD, 'u2');
  assert.equal(alex.games, 2);
  assert.equal(alex.wins, 1);
  assert.equal(alex.fooled, 3);

  await store.flush();

  const reopened = await openStore({ file });
  assert.equal(reopened.get(GUILD, 'u1').wins, 1);
  assert.equal(reopened.get(GUILD, 'u2').games, 2);

  const raw = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(raw.version, 1);
  assert.equal(raw.users[`${GUILD}:u1`].name, 'sam');
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

test('the leaderboard sorts by the chosen metric and skips idle users', async () => {
  const dir = await folder();
  const store = await openStore({ file: join(dir, 'stats.json') });

  await store.record({
    guildId: GUILD,
    players: [
      { id: 'a', name: 'a', found: 0, fooled: 9 },
      { id: 'b', name: 'b', found: 0, fooled: 2 },
      { id: 'c', name: 'c', found: 0, fooled: 5 }
    ],
    winnerIds: ['b'],
    rounds: 1
  });

  const ids = (metric) => store.top({ guildId: GUILD, metric }).map((row) => row.userId);

  assert.deepEqual(ids('wins'), ['b', 'a', 'c']);
  assert.deepEqual(ids('fooled'), ['a', 'c', 'b']);
  assert.equal(store.top({ guildId: GUILD, metric: 'fooled' })[0].fooled, 9);
  assert.equal(store.get(GUILD, 'nobody').games, 0);
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

test('unknown fields in the stats file do not leak into players', async () => {
  const dir = await folder();
  const file = join(dir, 'stats.json');
  await writeFile(
    file,
    JSON.stringify({ version: 1, users: { [`${GUILD}:u1`]: { guildId: GUILD, name: 'sam', games: 1, wins: 1 } } }),
    'utf8'
  );

  const store = await openStore({ file });
  const player = store.get(GUILD, 'u1');
  assert.equal(player.wins, 1);
  assert.equal(player.fooled, 0);
  assert.equal(player.best, 0);
});
