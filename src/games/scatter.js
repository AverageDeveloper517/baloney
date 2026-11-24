import { RoundGame, COLORS, bar, clean, mmss, pickMany, pickOne, scoreLines, truncate } from './base.js';

export const SCATTER_TIMING = { lobby: 3 * 60_000, play: 60_000, reveal: 12_000 };
export const SCATTER_LIMITS = { minPlayers: 2, maxPlayers: 10, rounds: 2, answerLength: 40, categories: 3 };
export const SCATTER_POINTS = { unique: 2, shared: 1, sweep: 3 };

const stripArticle = (value) => clean(value).toLowerCase().replace(/^(a|an|the)\s+/, '');

/**
 * Scatter: one letter, three categories, sixty seconds. An answer nobody else
 * wrote is worth two; an answer everyone wrote is worth one; an answer that does
 * not start with the letter is worth nothing.
 */
export class ScatterGame extends RoundGame {
  constructor({ categories, letters, rng = Math.random, rounds = SCATTER_LIMITS.rounds, ...rest }) {
    super({
      ...rest,
      rounds,
      minPlayers: SCATTER_LIMITS.minPlayers,
      maxPlayers: SCATTER_LIMITS.maxPlayers,
      playMs: SCATTER_TIMING.play,
      revealMs: SCATTER_TIMING.reveal,
      lobbyMs: SCATTER_TIMING.lobby
    });

    this.kind = 'scatter';
    this.rng = rng;
    this.categories = categories;
    this.letters = letters;
    this.answers = new Map();
    this.letter = 'a';
    this.roundCategories = [];
    this.reveal = null;
  }

  beginRound() {
    this.letter = pickOne(this.letters, this.rng);
    this.roundCategories = pickMany(this.categories, SCATTER_LIMITS.categories, this.rng);
    this.answers = new Map();
    this.reveal = null;
    for (const player of this.players) player.counters ??= { scatterAnswers: 0 };
  }

  hasActed(userId) {
    return this.answers.has(userId);
  }

  writeForm() {
    if (this.phase !== 'play') return null;
    return {
      title: `letter ${this.letter.toUpperCase()}`,
      customId: `gm:${this.id}`,
      inputs: this.roundCategories.map((category, index) => ({
        id: `c${index}`,
        label: `${this.letter.toUpperCase()} · ${truncate(category, 40)}`,
        placeholder: `starts with ${this.letter.toUpperCase()}`,
        min: 0,
        max: SCATTER_LIMITS.answerLength
      }))
    };
  }

  submit(userId, fields) {
    if (this.phase !== 'play') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.answers.has(userId)) return { ok: false, reason: 'already' };

    const values = this.roundCategories.map((_, index) => clean(fields?.[`c${index}`] ?? ''));
    if (!values.some(Boolean)) return { ok: false, reason: 'short' };

    this.answers.set(userId, values);
    return { ok: true };
  }

  validAnswer(value) {
    if (!value) return false;
    return stripArticle(value).startsWith(this.letter);
  }

  scoreRound() {
    const groups = this.roundCategories.map((_, index) => {
      const map = new Map();
      for (const [userId, values] of this.answers) {
        const value = values[index];
        if (!this.validAnswer(value)) continue;
        const key = stripArticle(value).replace(/[^a-z0-9]/g, '');
        if (!key) continue;
        const entry = map.get(key) ?? { key, users: [], display: value };
        entry.users.push(userId);
        map.set(key, entry);
      }
      return map;
    });

    const board = this.roundCategories.map((category, index) => {
      const rows = [];
      for (const [userId, values] of this.answers) {
        const value = values[index];
        const player = this.get(userId);
        if (!player) continue;

        if (!value) {
          rows.push({ userId, name: player.name, value: '', points: 0, valid: false });
          continue;
        }

        if (!this.validAnswer(value)) {
          rows.push({ userId, name: player.name, value, points: 0, valid: false });
          continue;
        }

        const key = stripArticle(value).replace(/[^a-z0-9]/g, '');
        const shared = (groups[index].get(key)?.users.length ?? 0) > 1;
        const points = shared ? SCATTER_POINTS.shared : SCATTER_POINTS.unique;
        player.score += points;
        player.counters ??= { scatterAnswers: 0 };
        player.counters.scatterAnswers += 1;
        rows.push({ userId, name: player.name, value, points, valid: true });
      }
      return { category, rows };
    });

    for (const player of this.active()) {
      const values = this.answers.get(player.id);
      if (!values) continue;
      const allUnique = this.roundCategories.every((_, index) => {
        const value = values[index];
        if (!this.validAnswer(value)) return false;
        const key = stripArticle(value).replace(/[^a-z0-9]/g, '');
        return (groups[index].get(key)?.users.length ?? 0) === 1;
      });
      if (allUnique) {
        player.score += SCATTER_POINTS.sweep;
        player.flags.add('unique-sweep');
      }
    }

    this.reveal = { round: this.round, letter: this.letter, board };
  }

  playView() {
    const total = this.active().length;
    const list = this.roundCategories.map((category, index) => `**${index + 1}** ${category}`).join('\n');

    return {
      color: COLORS.play,
      title: `round ${this.round}/${this.rounds} · letter ${this.letter.toUpperCase()}`,
      description:
        `**everything starts with ${this.letter.toUpperCase()}.**\n\n${list}\n\n` +
        'unique answers score 2. answers that match someone else score 1. wrong letter scores nothing.',
      fields: [{ name: 'sheets in', value: `${bar(this.answers.size, total)} ${this.answers.size}/${total}`, inline: false }],
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · all three answers score together`,
      rows: [[{ id: `sc:${this.id}:write`, label: 'Fill the sheet', style: 'primary' }]]
    };
  }

  revealView() {
    const reveal = this.reveal;
    const fields = reveal.board.map((column) => ({
      name: truncate(`${reveal.letter.toUpperCase()} · ${column.category}`, 250),
      value:
        column.rows
          .filter((row) => row.value)
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
          .map((row) => `${row.valid ? '' : '✗ '}**${row.name}** · ${truncate(row.value, 30)}${row.points ? ` (+${row.points})` : ''}`)
          .join('\n') || 'nobody',
      inline: false
    }));

    fields.push({ name: 'scores', value: scoreLines(this.standings(), { limit: 5 }), inline: false });

    return {
      color: COLORS.reveal,
      title: `letter ${reveal.letter.toUpperCase()} · the sheets`,
      description: 'unique answers paid double. anything that did not start with the letter was crossed out.',
      fields: fields.slice(0, 5),
      footer: `next round in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: []
    };
  }

  finalLine() {
    const top = this.standings()[0];
    if (!top || top.score <= 0) return 'nobody wrote a legal answer. the letter wins.';
    return `**${top.name}** filled the sheet best, with ${top.score} points.`;
  }

  awards() {
    const sweeps = this.players.filter((player) => player.flags.has('unique-sweep'));
    return sweeps.length ? `clean sweep · ${sweeps.map((player) => `**${player.name}**`).join(', ')}` : '';
  }
}
