import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BADGES,
  BADGE_BY_ID,
  COINS,
  GAME_KINDS,
  THEMES,
  THEME_BY_ID,
  XP,
  badgeNames,
  claimDaily,
  coinGain,
  equipTheme,
  levelFor,
  levelProgress,
  ownsTheme,
  settleGame,
  settleParty,
  themeColor,
  xpForLevel,
  xpGain
} from '../src/meta.js';
import { memoryStore } from '../test-support/helpers.js';

const GUILD = 'g1';
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 0, 10, 12, 0, 0);

const player = (id, overrides = {}) => ({
  id,
  name: id,
  score: 0,
  flags: new Set(),
  counters: {},
  ...overrides
});

test('the level curve is cumulative, monotonic and safe at zero', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 100);
  assert.equal(xpForLevel(3), 300);
  assert.equal(xpForLevel(10), 4500);
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(99), 1);
  assert.equal(levelFor(100), 2);
  assert.equal(levelFor(-50), 1);

  let previous = -1;
  for (let level = 1; level < 40; level += 1) {
    const floor = xpForLevel(level);
    assert.ok(floor > previous, 'the curve always climbs');
    assert.equal(levelFor(floor), level);
    previous = floor;
  }

  const progress = levelProgress(150);
  assert.equal(progress.level, 2);
  assert.equal(progress.into, 50);
  assert.equal(progress.span, 200);
  assert.equal(progress.pct, 25);
  assert.equal(progress.next, 300);
});

test('xp and coin rewards follow rounds and wins', () => {
  assert.equal(xpGain({ rounds: 1 }), XP.base + XP.perRound);
  assert.equal(xpGain({ rounds: 3, won: true }), XP.base + XP.perRound * 3 + XP.win);
  assert.equal(xpGain({ rounds: 1, won: true, party: true }), XP.base + XP.perRound + XP.win + XP.party);
  assert.equal(coinGain({ rounds: 2 }), COINS.base + COINS.perRound * 2);
  assert.equal(coinGain({ rounds: 1, won: true }), COINS.base + COINS.perRound + COINS.win);
});

test('settling a game updates every counter once and awards the first badges', async () => {
  const store = memoryStore();

  const result = await settleGame({
    store,
    guildId: GUILD,
    kind: 'bluff',
    players: [
      player('u1', { score: 1500, found: 1, fooled: 2, best: 2, flags: new Set(['big-lie']) }),
      player('u2', { score: 0, counters: { rounds: 1 } })
    ],
    winnerIds: ['u1'],
    rounds: 2
  });

  assert.equal(result.length, 2);
  const winner = store.get(GUILD, 'u1');
  assert.equal(winner.games, 1);
  assert.equal(winner.wins, 1);
  assert.equal(winner.rounds, 2);
  assert.equal(winner.found, 1);
  assert.equal(winner.fooled, 2);
  assert.equal(winner.best, 2);
  assert.equal(winner.xp, XP.base + XP.perRound * 2 + XP.win);
  assert.equal(winner.coins, COINS.base + COINS.perRound * 2 + COINS.win);
  assert.deepEqual(winner.kinds, ['bluff']);
  assert.deepEqual(winner.badges.sort(), ['big-lie', 'first-game', 'first-win']);

  const loser = store.get(GUILD, 'u2');
  assert.equal(loser.wins, 0);
  assert.equal(loser.counters.rounds, 1);
  assert.deepEqual(loser.badges, ['first-game']);

  // A second identical game does not duplicate badges or kinds.
  await settleGame({
    store,
    guildId: GUILD,
    kind: 'bluff',
    players: [player('u1')],
    winnerIds: [],
    rounds: 1
  });
  const again = store.get(GUILD, 'u1');
  assert.deepEqual(again.kinds, ['bluff']);
  assert.equal(new Set(again.badges).size, again.badges.length);
});

test('the badge catalogue is unique, complete and has a check for every entry', () => {
  const ids = new Set();
  for (const badge of BADGES) {
    assert.equal(ids.has(badge.id), false, `duplicate badge ${badge.id}`);
    ids.add(badge.id);
    assert.ok(badge.name.length > 0 && badge.name.length <= 40);
    assert.ok(badge.desc.length > 0 && badge.desc.length <= 90);
    assert.equal(typeof badge.check, 'function');
    assert.equal(BADGE_BY_ID[badge.id], badge);
  }
  assert.equal(BADGES.length, 28);
  assert.deepEqual(badgeNames(['first-game', 'missing']), ['First Timer', 'missing']);
});

test('collection badges watch the whole record, not one game', async () => {
  const store = memoryStore();

  for (const kind of GAME_KINDS) {
    await settleGame({ store, guildId: GUILD, kind, players: [player('u1')], rounds: 1 });
  }

  const entry = store.get(GUILD, 'u1');
  assert.deepEqual(entry.kinds.sort(), [...GAME_KINDS].sort());
  assert.ok(entry.badges.includes('explorer'), 'all nine games unlock explorer');
  assert.ok(entry.badges.includes('five-games'));
  assert.ok(entry.badges.includes('twentyfive-games') === false);
});

test('party settlement pays a roster once and awards the party badge', async () => {
  const store = memoryStore();
  await settleParty({ store, guildId: GUILD, players: [{ id: 'u1', name: 'sam' }, { id: 'u2', name: 'alex' }] });

  const one = store.get(GUILD, 'u1');
  assert.equal(one.xp, XP.party);
  assert.equal(one.coins, COINS.party);
  assert.ok(one.badges.includes('party-animal'));
  assert.ok(one.kinds.includes('party'));

  await settleParty({ store, guildId: GUILD, players: [{ id: 'u1', name: 'sam' }] });
  assert.equal(store.get(GUILD, 'u1').badges.filter((id) => id === 'party-animal').length, 1);
});

test('daily coins pay once, grow with the streak and reset after a missed day', async () => {
  const store = memoryStore();

  const first = await claimDaily({ store, guildId: GUILD, userId: 'u1', name: 'sam', now: NOW });
  assert.equal(first.ok, true);
  assert.equal(first.streak, 1);
  assert.equal(first.reward, COINS.daily);
  assert.equal(first.coins, COINS.daily);

  const again = await claimDaily({ store, guildId: GUILD, userId: 'u1', name: 'sam', now: NOW + 60_000 });
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'claimed');
  assert.equal(store.get(GUILD, 'u1').coins, COINS.daily);

  const second = await claimDaily({ store, guildId: GUILD, userId: 'u1', name: 'sam', now: NOW + DAY });
  assert.equal(second.streak, 2);
  assert.equal(second.reward, COINS.daily + COINS.streakStep);

  let day = NOW + DAY;
  for (let i = 3; i <= 8; i += 1) {
    day += DAY;
    const claim = await claimDaily({ store, guildId: GUILD, userId: 'u1', name: 'sam', now: day });
    assert.equal(claim.streak, i);
    assert.ok(claim.reward <= 60, 'the streak bonus caps out');
  }

  const missed = await claimDaily({ store, guildId: GUILD, userId: 'u1', name: 'sam', now: day + DAY * 3 });
  assert.equal(missed.streak, 1, 'a missed day resets the streak');
  assert.equal(missed.reward, COINS.daily);
});

test('themes are cosmetic, cost coins once and can be swapped freely', async () => {
  const store = memoryStore();
  await store.updateUser(GUILD, 'u1', (entry) => {
    entry.coins = 500;
    entry.name = 'sam';
  });

  assert.equal(ownsTheme(store.get(GUILD, 'u1'), 'default'), true);
  assert.equal(ownsTheme(store.get(GUILD, 'u1'), 'mint'), false);

  const poor = await equipTheme({
    store,
    guildId: GUILD,
    userId: 'u1',
    name: 'sam',
    id: 'ocean'
  });
  assert.equal(poor.ok, false);
  assert.equal(poor.reason, 'coins');
  assert.equal(poor.need, 300);

  const bought = await equipTheme({ store, guildId: GUILD, userId: 'u1', name: 'sam', id: 'mint' });
  assert.equal(bought.ok, true);
  assert.equal(bought.bought, true);
  assert.equal(bought.coins, 250);
  assert.equal(store.get(GUILD, 'u1').theme, 'mint');
  assert.equal(ownsTheme(store.get(GUILD, 'u1'), 'mint'), true);

  const free = await equipTheme({ store, guildId: GUILD, userId: 'u1', name: 'sam', id: 'mint' });
  assert.equal(free.ok, true);
  assert.equal(free.bought, false);
  assert.equal(free.coins, 250, 're-equipping does not charge again');

  const unknown = await equipTheme({ store, guildId: GUILD, userId: 'u1', name: 'sam', id: 'gold-plated' });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'unknown');

  for (const theme of THEMES) {
    assert.equal(THEME_BY_ID[theme.id], theme);
    assert.equal(themeColor(theme.id), theme.color);
  }
  assert.equal(themeColor('missing'), THEME_BY_ID.default.color);
});
