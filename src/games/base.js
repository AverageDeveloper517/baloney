// Shared pieces for every game: the lobby, safe text handling and the tiny
// view model that the UI layer turns into a Discord message.
//
// Game classes never import discord.js. That keeps them synchronous, testable
// and independent of the transport.

export const COLORS = {
  lobby: 0xf2b544,
  play: 0x5b6c8f,
  vote: 0xe4572e,
  reveal: 0x3fa796,
  final: 0xf2b544,
  closed: 0x8d99ae,
  party: 0x9b5de5
};

export const LETTERS = 'ABCDEFGHIJK'.split('');

export const PACE = { fast: 0.65, standard: 1, relaxed: 1.4 };

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

/** Letters and digits only. Used when comparing short answers. */
export function squish(value) {
  return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
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

export function pickOne(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
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

/** One button per option, split into rows of five. */
export function optionRows({ ns, id, options, style = 'secondary' }) {
  const rows = [];
  for (let i = 0; i < options.length; i += 5) {
    rows.push(
      options.slice(i, i + 5).map((option) => ({
        id: `${ns}:${id}:v:${option.value}`,
        label: option.label,
        style: option.style ?? style,
        disabled: Boolean(option.disabled)
      }))
    );
  }
  return rows;
}

/** "3 players", "1 player". */
export const plural = (count, word, ending = 's') => `${count} ${word}${count === 1 ? '' : ending}`;

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
    pace = 1,
    clock = Date.now,
    ns = 'bl',
    label = 'this game',
    blurb = 'press join and the host starts when everyone is in.'
  }) {
    this.id = id;
    this.channelId = channelId;
    this.guildId = guildId;
    this.hostId = hostId;
    this.ns = ns;
    this.label = label;
    this.blurb = blurb;
    this.minPlayers = minPlayers;
    this.maxPlayers = maxPlayers;
    this.clock = clock;
    this.pace = Number.isFinite(Number(pace)) && Number(pace) > 0 ? Number(pace) : 1;

    this.players = [];
    this.phase = 'lobby';
    this.phaseEndsAt = clock() + this.ms(lobbyMs);
    this.createdAt = clock();
    this.messageId = null;
    this.flags = new Set();
  }

  /** Scale a base duration by the server's pace setting. */
  ms(base) {
    return Math.round(base * this.pace);
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

  get closed() {
    return this.phase === 'done' || this.phase === 'dead';
  }

  /** Returns a machine-readable reason so the router can write the reply. */
  add({ id, name }) {
    if (this.phase !== 'lobby') return { ok: false, reason: 'started' };
    if (this.has(id)) return { ok: false, reason: 'already' };
    if (this.full) return { ok: false, reason: 'full' };

    this.players.push({ id, name: safeName(name), score: 0, left: false, flags: new Set() });
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

  /** Base card for a lobby that timed out or was cancelled. */
  closedView(title, description) {
    return {
      color: COLORS.closed,
      title,
      description,
      fields: [],
      footer: 'the party continues with /help',
      rows: []
    };
  }

  /**
   * Default lobby card. Games with more flavour can override it, but every game
   * needs a lobby screen that is safe to render before it starts.
   */
  lobbyView() {
    const host = this.host?.name ?? 'nobody';
    const names = this.players.length
      ? this.players
          .map((player) => (player.id === this.hostId ? `**${player.name}** · host` : player.name))
          .join('\n')
      : 'nobody yet';

    const rows = [
      [
        { id: `${this.ns}:${this.id}:join`, label: 'Join', style: 'primary' },
        { id: `${this.ns}:${this.id}:leave`, label: 'Leave', style: 'secondary' }
      ],
      [
        { id: `${this.ns}:${this.id}:start`, label: 'Start', style: 'success' },
        { id: `${this.ns}:${this.id}:cancel`, label: 'Cancel', style: 'danger' }
      ]
    ];

    return {
      color: COLORS.lobby,
      title: `${this.label} · lobby`,
      description:
        `**${this.blurb}**\n\n` +
        `the host is **${host}**. ${plural(this.minPlayers, 'player')} to start, ${this.maxPlayers} max.\n\n${names}`,
      fields: [{ name: 'players', value: `${this.size}/${this.minPlayers} minimum`, inline: false }],
      footer: 'one game, one message · press Join, then the host presses Start',
      rows
    };
  }

  /** Players sorted by score, then by tie-breakers the game cares about. */
  standings() {
    return [...this.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  /** Player ids that share the top score, ignoring zero-score games. */
  winners() {
    const standings = this.standings();
    const top = standings[0]?.score ?? 0;
    return top > 0 ? standings.filter((player) => player.score === top).map((player) => player.id) : [];
  }

  /** Per-game flavour line for the final card. */
  finalLine() {
    const winners = this.standings().filter((player) => this.winners().includes(player.id));
    return winners.length
      ? winners.length === 1
        ? `**${winners[0].name}** takes it with ${winners[0].score}.`
        : `${winners.map((player) => `**${player.name}**`).join(' and ')} tie on ${winners[0].score}.`
      : 'nobody scored. remarkable.';
  }

  /** Extra final-card field, if the game has one. */
  awards() {
    return '';
  }

  /** Consumed by the meta layer: what this game contributed per player. */
  results() {
    return this.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      flags: [...(player.flags ?? [])],
      counters: player.counters ?? {}
    }));
  }

  finalView() {
    const awards = this.awards();
    const fields = [{ name: 'final', value: scoreLines(this.standings(), { limit: 10 }) || 'no points', inline: false }];
    if (awards) fields.push({ name: 'awards', value: awards, inline: false });

    return {
      color: COLORS.final,
      title: 'the standings',
      description: `${this.finalLine()}\n\n${this.rounds ?? 1} round${(this.rounds ?? 1) === 1 ? '' : 's'}, ${plural(this.players.length, 'player')}.`,
      fields,
      footer: 'one game, one message · /party runs the whole night',
      rows: [],
      invite: true
    };
  }
}

/**
 * A game made of identical rounds where each round has one action phase and one
 * reveal. Trivia, would-you-rather and the number game all fit this shape.
 */
export class RoundGame extends Lobby {
  constructor({
    rounds = 3,
    playMs = 30_000,
    revealMs = 7_000,
    lobbyMs = 3 * 60_000,
    ...rest
  }) {
    super({ ...rest, lobbyMs });
    this.rounds = clamp(Number(rounds) || 3, 1, 6);
    this.playMs = playMs;
    this.revealMs = revealMs;
    this.round = 0;
    this.reveal = null;
    this.history = [];
  }

  start() {
    if (this.phase !== 'lobby') return { ok: false, reason: 'phase' };
    if (this.size < this.minPlayers) return { ok: false, reason: 'few' };
    this.begin();
    return { ok: true };
  }

  begin() {
    this.round += 1;
    this.reveal = null;
    this.beginRound();
    this.phase = 'play';
    this.phaseEndsAt = this.clock() + this.ms(this.playMs);
  }

  /** Subclasses reset their round state here. */
  beginRound() {}

  /** True when every active player has acted, so the phase can close early. */
  allActed() {
    return this.players.every((player) => player.left || this.hasActed(player.id));
  }

  hasActed() {
    return false;
  }

  tick(now = this.clock()) {
    switch (this.phase) {
      case 'lobby':
        this.phase = 'dead';
        this.phaseEndsAt = null;
        return true;
      case 'play':
        this.resolve(now);
        return true;
      case 'reveal':
        return this.nextRound();
      default:
        return false;
    }
  }

  advanceIfReady(now = this.clock()) {
    if (this.phase === 'play' && this.allActed()) return this.resolve(now);
    return false;
  }

  resolve(now = this.clock()) {
    if (this.phase !== 'play') return false;
    this.scoreRound();
    this.phase = 'reveal';
    this.phaseEndsAt = now + this.ms(this.revealMs);
    this.history.push(this.reveal);
    return true;
  }

  /** Subclasses compute scores, flags and this.reveal here. */
  scoreRound() {}

  nextRound() {
    if (this.phase !== 'reveal') return false;
    if (this.round >= this.rounds) {
      this.finishUp();
      return true;
    }
    this.begin();
    return true;
  }

  /** Called once, after the last reveal. */
  finishUp() {
    this.phase = 'done';
    this.phaseEndsAt = null;
  }

  view() {
    if (this.phase === 'lobby') return this.lobbyView();
    if (this.phase === 'dead') {
      return this.closedView('nobody started', 'the lobby timed out before enough players joined.');
    }
    if (this.phase === 'done') return this.finalView();

    return this.phase === 'reveal' ? this.revealView() : this.playView();
  }

  playView() {
    return this.closedView('nothing to show', 'this game has no action screen.');
  }

  revealView() {
    return this.closedView('round over', 'this game has no reveal screen.');
  }
}
