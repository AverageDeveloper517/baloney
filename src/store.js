import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const VERSION = 1;
const DM = 'dm';

const blank = () => ({ version: VERSION, users: {} });

const blankUser = (name = 'player') => ({
  userId: null,
  guildId: null,
  name,
  games: 0,
  wins: 0,
  rounds: 0,
  found: 0,
  fooled: 0,
  best: 0,
  lastPlayed: 0
});

const number = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0);

const hydrate = (raw = {}) => {
  const base = blankUser(raw.name);
  return {
    ...base,
    ...raw,
    userId: typeof raw.userId === 'string' ? raw.userId : null,
    guildId: typeof raw.guildId === 'string' ? raw.guildId : DM,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 32) : base.name,
    games: number(raw.games),
    wins: number(raw.wins),
    rounds: number(raw.rounds),
    found: number(raw.found),
    fooled: number(raw.fooled),
    best: number(raw.best),
    lastPlayed: number(raw.lastPlayed)
  };
};

const keyFor = (guildId, userId) => `${guildId ?? DM}:${userId}`;

/**
 * One JSON file, written atomically. Records are scoped to the server, so a
 * player's record in one server is not visible in another. No accounts, no
 * database, no migrations: delete the file to wipe everything.
 */
export async function openStore({ file, log = () => {} }) {
  let data = blank();
  let pending = Promise.resolve();

  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.users && typeof parsed.users === 'object') {
      data = {
        version: VERSION,
        users: Object.fromEntries(
          Object.entries(parsed.users).map(([key, entry]) => [key, hydrate(entry)])
        )
      };
    } else {
      throw new Error('unexpected shape');
    }
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
    pending = pending.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      await rename(temp, file);
    });
    return pending;
  }

  return {
    get file() {
      return file;
    },

    get(guildId, userId) {
      const entry = data.users[keyFor(guildId, userId)];
      return entry ? { ...entry } : blankUser();
    },

    /** Update every player after a finished game, inside one server. */
    async record({ guildId = null, players = [], winnerIds = [], rounds = 0 } = {}) {
      const winners = new Set(winnerIds);
      const now = Date.now();

      for (const player of players) {
        if (!player?.id) continue;

        const key = keyFor(guildId, player.id);
        const entry = data.users[key] ?? blankUser(player.name);

        entry.userId = player.id;
        entry.guildId = guildId ?? DM;
        entry.name = player.name ?? entry.name;
        entry.games += 1;
        entry.rounds += number(rounds);
        entry.found += number(player.found);
        entry.fooled += number(player.fooled);
        entry.best = Math.max(entry.best, number(player.best));
        entry.wins += winners.has(player.id) ? 1 : 0;
        entry.lastPlayed = now;

        data.users[key] = entry;
      }

      await persist();
      return true;
    },

    top({ guildId = null, metric = 'wins', limit = 10 } = {}) {
      const rows = Object.values(data.users).filter(
        (user) => user.guildId === (guildId ?? DM) && user.games > 0
      );

      const sorters = {
        wins: (a, b) => b.wins - a.wins || b.fooled - a.fooled || b.games - a.games,
        fooled: (a, b) => b.fooled - a.fooled || b.wins - a.wins || b.games - a.games,
        games: (a, b) => b.games - a.games || b.wins - a.wins
      };

      return rows.sort(sorters[metric] ?? sorters.wins).slice(0, limit);
    },

    async flush() {
      await pending;
    }
  };
}

export { blankUser };
