// Progression that is entirely free: XP, levels, coins, badges and daily
// streaks. Nothing here can be bought with real money, and nothing gates a
// command. Coins only unlock cosmetic card colours.

export const XP = { base: 20, perRound: 5, win: 25, party: 15 };
export const COINS = { base: 10, perRound: 2, win: 15, daily: 30, streakStep: 5, party: 20 };

const int = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0);

/** Cumulative XP needed to reach a level. Level 1 starts at zero. */
export function xpForLevel(level) {
  const n = Math.max(1, Math.floor(level));
  return 50 * (n - 1) * n;
}

export function levelFor(xp) {
  const value = Math.max(0, int(xp));
  let level = 1;
  while (value >= xpForLevel(level + 1)) level += 1;
  return level;
}

export function levelProgress(xp) {
  const value = Math.max(0, int(xp));
  const level = levelFor(value);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - floor);
  return { level, into: value - floor, span, next, pct: Math.round(((value - floor) / span) * 100) };
}

export function xpGain({ rounds = 1, won = false, party = false } = {}) {
  return XP.base + XP.perRound * int(rounds) + (won ? XP.win : 0) + (party ? XP.party : 0);
}

export function coinGain({ rounds = 1, won = false, party = false } = {}) {
  return COINS.base + COINS.perRound * int(rounds) + (won ? COINS.win : 0) + (party ? COINS.party : 0);
}

const flagSet = (player) => {
  if (player?.flags instanceof Set) return player.flags;
  if (Array.isArray(player?.flags)) return new Set(player.flags);
  return new Set();
};

/** The nine playable games. `party` is a night, not a tenth game. */
export const GAME_KINDS = ['bluff', 'mostlikely', 'trivia', 'wyr', 'number', 'duel', 'chain', 'impostor', 'scatter'];

/** Badge catalogue. `check(entry, ctx)` runs after the game has been added. */
export const BADGES = [
  { id: 'first-game', name: 'First Timer', desc: 'finish your first game', check: (e) => e.games >= 1 },
  { id: 'first-win', name: 'Opening Night', desc: 'win your first game', check: (e) => e.wins >= 1 },
  { id: 'five-games', name: 'Regular', desc: 'finish 5 games', check: (e) => e.games >= 5 },
  { id: 'twentyfive-games', name: 'Fixture', desc: 'finish 25 games', check: (e) => e.games >= 25 },
  { id: 'hundred-games', name: 'Institution', desc: 'finish 100 games', check: (e) => e.games >= 100 },
  { id: 'ten-wins', name: 'Serial Winner', desc: 'win 10 games', check: (e) => e.wins >= 10 },
  { id: 'fifty-wins', name: 'Dynasty', desc: 'win 50 games', check: (e) => e.wins >= 50 },
  { id: 'liar-10', name: 'Confident Liar', desc: 'fool 10 people with your lies', check: (e) => e.fooled >= 10 },
  { id: 'liar-100', name: 'Professional Liar', desc: 'fool 100 people', check: (e) => e.fooled >= 100 },
  { id: 'big-lie', name: 'Whopper', desc: 'get 5 votes on a single lie', check: (e, c) => c.flags.has('big-lie') },
  { id: 'detective-10', name: 'Truth Spotter', desc: 'find the real answer 10 times', check: (e) => e.found >= 10 },
  { id: 'detective-50', name: 'Human Lie Detector', desc: 'find the real answer 50 times', check: (e) => e.found >= 50 },
  { id: 'perfect', name: 'Flawless', desc: 'answer every trivia question correctly', check: (e, c) => c.flags.has('perfect') },
  { id: 'sharp', name: 'Quiz Machine', desc: 'answer 50 trivia questions correctly', check: (e) => e.correct >= 50 },
  { id: 'caught', name: 'Sharp Eyes', desc: 'vote out the impostor', check: (e, c) => c.flags.has('caught') },
  { id: 'slipped', name: 'Perfect Crime', desc: 'survive a round as the impostor', check: (e, c) => c.flags.has('slipped') },
  { id: 'unique-sweep', name: 'Clean Sweep', desc: 'write three unique scatter answers in one round', check: (e, c) => c.flags.has('unique-sweep') },
  { id: 'bullseye', name: 'Bullseye', desc: 'guess the secret number exactly', check: (e, c) => c.flags.has('bullseye') },
  { id: 'contrarian', name: 'Contrarian', desc: 'pick the tiny minority in would-you-rather', check: (e, c) => c.flags.has('contrarian') },
  { id: 'duelist', name: 'Duelist', desc: 'win a duel', check: (e, c) => c.flags.has('duelist') },
  { id: 'crowd-pleaser', name: 'Crowd Pleaser', desc: 'win a chain story vote', check: (e, c) => c.flags.has('crowd-pleaser') },
  { id: 'favourite', name: 'Room Favourite', desc: 'top a most-likely-to round', check: (e, c) => c.flags.has('favourite') },
  { id: 'explorer', name: 'Explorer', desc: 'play all nine games', check: (e) => GAME_KINDS.every((kind) => e.kinds.includes(kind)) },
  { id: 'party-animal', name: 'Party Animal', desc: 'finish a whole party night', check: (e, c) => c.flags.has('party-animal') },
  { id: 'streak-7', name: 'Week of It', desc: 'claim a daily reward 7 days in a row', check: (e) => e.streak >= 7 },
  { id: 'rich', name: 'Coin Collector', desc: 'hold 1,000 coins', check: (e) => e.coins >= 1000 },
  { id: 'level-10', name: 'Double Digits', desc: 'reach level 10', check: (e) => levelFor(e.xp) >= 10 },
  { id: 'level-25', name: 'Veteran', desc: 'reach level 25', check: (e) => levelFor(e.xp) >= 25 }
];

export const BADGE_BY_ID = Object.fromEntries(BADGES.map((badge) => [badge.id, badge]));

export const THEMES = [
  { id: 'default', name: 'House Gold', price: 0, color: 0xf2b544, blurb: 'the house colour' },
  { id: 'mint', name: 'Mint', price: 250, color: 0x3fa796, blurb: 'freshly printed' },
  { id: 'rose', name: 'Rose', price: 400, color: 0xe4572e, blurb: 'a little dangerous' },
  { id: 'violet', name: 'Violet', price: 600, color: 0x9b5de5, blurb: 'party lighting' },
  { id: 'ocean', name: 'Ocean', price: 800, color: 0x2d6cdf, blurb: 'deep end' },
  { id: 'midnight', name: 'Midnight', price: 1200, color: 0x1f2430, blurb: 'for the night owls' }
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((theme) => [theme.id, theme]));
export const themeColor = (id) => (THEME_BY_ID[id] ?? THEME_BY_ID.default).color;

export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/**
 * Add a finished game to every player's record, award XP, coins and any badges
 * that just unlocked. One write for the whole table.
 */
export async function settleGame({ store, guildId, kind, players, winnerIds = [], rounds = 1, party = false }) {
  const winners = new Set(winnerIds);
  const count = Math.max(1, int(rounds));

  return store.updateUsers(guildId, players, (entry, player) => {
    const won = winners.has(player.id);
    const flags = flagSet(player);
    const ctx = { kind, won, flags, score: int(player.score) };

    entry.games += 1;
    entry.wins += won ? 1 : 0;
    entry.rounds += count;
    entry.xp += xpGain({ rounds: count, won, party });
    entry.coins += coinGain({ rounds: count, won, party });

    entry.found += int(player.found);
    entry.fooled += int(player.fooled);
    entry.best = Math.max(entry.best, int(player.best));
    entry.correct += int(player.correct);
    entry.answers += int(player.answers);

    if (player.counters && typeof player.counters === 'object') {
      for (const [key, value] of Object.entries(player.counters)) {
        if (typeof key !== 'string' || key.length > 32) continue;
        entry.counters[key] = int(entry.counters[key]) + int(value);
      }
    }

    if (!entry.kinds.includes(kind)) entry.kinds.push(kind);

    const unlocked = [];
    for (const badge of BADGES) {
      if (entry.badges.includes(badge.id)) continue;
      if (!badge.check(entry, ctx)) continue;
      entry.badges.push(badge.id);
      unlocked.push(badge.id);
    }

    return unlocked;
  });
}

/** Party night completion: a badge, a little XP and a few coins for the roster. */
export async function settleParty({ store, guildId, players }) {
  return store.updateUsers(guildId, players, (entry) => {
    entry.xp += XP.party;
    entry.coins += COINS.party;
    if (!entry.kinds.includes('party')) entry.kinds.push('party');
    if (!entry.badges.includes('party-animal')) entry.badges.push('party-animal');
  });
}

/** Claim today's coins. Streaks reset when a day is missed. */
export async function claimDaily({ store, guildId, userId, name, now = Date.now() }) {
  const entry = store.get(guildId, userId);
  const today = dayKey(now);

  if (entry.lastDaily === today) {
    return { ok: false, reason: 'claimed', streak: entry.streak, coins: entry.coins, reward: 0 };
  }

  const yesterday = dayKey(now - 86_400_000);
  const streak = entry.lastDaily === yesterday ? entry.streak + 1 : 1;
  const reward = COINS.daily + COINS.streakStep * Math.min(streak - 1, 6);

  const updated = await store.updateUser(
    guildId,
    userId,
    (row) => {
      row.lastDaily = today;
      row.streak = streak;
      row.coins += reward;
      if (streak >= 7 && !row.badges.includes('streak-7')) row.badges.push('streak-7');
    },
    name
  );

  return { ok: true, streak, reward, coins: updated.coins, entry: updated };
}

/**
 * Buy or equip a theme. Owning is permanent; equipping is free.
 */
export async function equipTheme({ store, guildId, userId, name, id }) {
  const theme = THEME_BY_ID[id];
  if (!theme) return { ok: false, reason: 'unknown' };

  const entry = store.get(guildId, userId);
  const owned = entry.counters?.[`theme:${theme.id}`] === 1;

  if (theme.id !== 'default' && !owned) {
    if (entry.coins < theme.price) {
      return { ok: false, reason: 'coins', need: theme.price - entry.coins, coins: entry.coins, theme };
    }
  }

  const updated = await store.updateUser(
    guildId,
    userId,
    (row) => {
      if (theme.id !== 'default' && !owned) {
        row.coins -= theme.price;
        row.counters[`theme:${theme.id}`] = 1;
      }
      row.theme = theme.id;
    },
    name
  );

  return { ok: true, bought: theme.id !== 'default' && !owned, theme, coins: updated.coins, entry: updated };
}

export function ownsTheme(entry, id) {
  if (id === 'default') return true;
  return entry?.counters?.[`theme:${id}`] === 1;
}

export function profileLine(entry) {
  const progress = levelProgress(entry.xp);
  const accuracy = entry.answers ? Math.round((entry.correct / entry.answers) * 100) : 0;
  return { progress, accuracy };
}

export function badgeNames(ids = []) {
  return ids.map((id) => BADGE_BY_ID[id]?.name ?? id);
}
