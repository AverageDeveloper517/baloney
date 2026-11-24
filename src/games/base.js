// Shared pieces for every game: the lobby, safe text handling and the tiny
// view model that the UI layer turns into a Discord message.
//
// Game classes never import discord.js. That keeps them synchronous, testable
// and independent of the transport.

export const COLORS = {
  lobby: 0xf2b544,
  submit: 0x5b6c8f,
  vote: 0xe4572e,
  reveal: 0x3fa796,
  final: 0xf2b544,
  closed: 0x8d99ae
};

export const LETTERS = 'ABCDEFGHIJK'.split('');

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Strip control characters, zero-width junk and collapse whitespace. */
export function clean(value) {
  return String(value ?? '')
    .replace(/<@[!&]?\d+>/g, '@someone')
    .replace(/<#\d+>/g, '#channel')
    .replace(/@(everyone|here)\b/gi, '$1')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparison form: no punctuation, no case, no double spaces. */
export function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Names are shown in public messages, so drop anything that could restyle the
 * card or ping a role, and keep them short enough for a button label.
 */
export function safeName(value, fallback = 'player') {
  const name = clean(value)
    .replace(/[@`*_~|\\<>]/g, '')
    .slice(0, 20)
    .trim();
  return name || fallback;
}

export function truncate(value, max) {
  const text = clean(value);
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickMany(list, count, rng = Math.random) {
  const pool = shuffle(list, rng);
  const out = [];
  while (out.length < count && pool.length) out.push(pool.shift());
  // Small banks are allowed; cycle rather than invent entries.
  let index = 0;
  while (out.length < count && list.length) {
    out.push(list[index % list.length]);
    index += 1;
  }
  return out;
}

export function newId() {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

export function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function bar(done, total, size = 8) {
  if (!total) return '▱'.repeat(size);
  const filled = clamp(Math.round((done / total) * size), 0, size);
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

export const renderPrompt = (prompt) => String(prompt).replace(/_{2,}/g, '▁▁▁▁');

export const MEDALS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export function scoreLines(players, { limit = 10, unit = '' } = {}) {
  return players
    .slice(0, limit)
    .map((player, index) => `${MEDALS[index] ?? `${index + 1}.`} **${player.name}** · ${player.score}${unit}`)
    .join('\n');
}

/**
 * A lobby is the state every game shares: a host, a guest list, a phase and a
 * deadline. Subclasses add rounds on top.
 */
export class Lobby {
  constructor({
    id = newId(),
    channelId,
    guildId = null,
    hostId,
    minPlayers = 3,
    maxPlayers = 10,
    lobbyMs = 5 * 60_000,
    clock = Date.now
  }) {
    this.id = id;
    this.channelId = channelId;
    this.guildId = guildId;
    this.hostId = hostId;
    this.minPlayers = minPlayers;
    this.maxPlayers = maxPlayers;
    this.clock = clock;

    this.players = [];
    this.phase = 'lobby';
    this.phaseEndsAt = clock() + lobbyMs;
    this.createdAt = clock();
    this.messageId = null;
  }

  get size() {
    return this.players.length;
  }

  get full() {
    return this.players.length >= this.maxPlayers;
  }

  active() {
    return this.players.filter((player) => !player.left);
  }

  has(userId) {
    return this.players.some((player) => player.id === userId);
  }

  get(userId) {
    return this.players.find((player) => player.id === userId) ?? null;
  }

  get host() {
    return this.get(this.hostId);
  }

  /** Returns a machine-readable reason so the router can write the reply. */
  add({ id, name }) {
    if (this.phase !== 'lobby') return { ok: false, reason: 'started' };
    if (this.has(id)) return { ok: false, reason: 'already' };
    if (this.full) return { ok: false, reason: 'full' };

    this.players.push({ id, name: safeName(name), score: 0, left: false });
    return { ok: true, count: this.players.length };
  }

  remove(id) {
    const index = this.players.findIndex((player) => player.id === id);
    if (index < 0) return { ok: false, reason: 'missing' };

    if (this.phase !== 'lobby') {
      // Keep the score on the board, but stop asking them for input.
      this.players[index].left = true;
      if (this.hostId === id) this.hostId = this.active()[0]?.id ?? null;
      return { ok: true, leaving: true };
    }

    this.players.splice(index, 1);
    if (this.hostId === id) this.hostId = this.players[0]?.id ?? null;
    return { ok: true, count: this.players.length };
  }

  cancel() {
    if (this.phase === 'done' || this.phase === 'dead') return false;
    this.phase = 'dead';
    this.phaseEndsAt = null;
    return true;
  }

  get closed() {
    return this.phase === 'done' || this.phase === 'dead';
  }

  /** Base card for a lobby that timed out or was cancelled. */
  closedView(title, description) {
    return {
      color: COLORS.closed,
      title,
      description,
      fields: [],
      footer: '/bluff or /mostlikely for a fresh one',
      rows: []
    };
  }
}
