import { RoundGame, COLORS, bar, mmss, scoreLines, truncate } from './base.js';

export const NUMBER_TIMING = { lobby: 3 * 60_000, play: 35_000, reveal: 7_000 };
export const NUMBER_LIMITS = { minPlayers: 2, maxPlayers: 12, rounds: 3 };
export const NUMBER_POINTS = { exact: 5, closest: 3, second: 1 };

/**
 * The Number Game: a secret number between 1 and 100. Everyone guesses, the
 * closest guess scores, and an exact hit is worth double.
 */
export class NumberGame extends RoundGame {
  constructor({ rng = Math.random, rounds = NUMBER_LIMITS.rounds, ...rest }) {
    super({
      ...rest,
      rounds,
      minPlayers: NUMBER_LIMITS.minPlayers,
      maxPlayers: NUMBER_LIMITS.maxPlayers,
      playMs: NUMBER_TIMING.play,
      revealMs: NUMBER_TIMING.reveal,
      lobbyMs: NUMBER_TIMING.lobby
    });

    this.kind = 'number';
    this.rng = rng;
    this.guesses = new Map();
    this.secret = null;
    this.previous = null;
    this.reveal = null;
  }

  beginRound() {
    this.guesses = new Map();
    this.reveal = null;

    let secret = 1 + Math.floor(this.rng() * 100);
    if (secret === this.previous) secret = (secret % 100) + 1;
    this.previous = secret;
    this.secret = secret;

    for (const player of this.players) player.counters ??= { guesses: 0 };
  }

  hasActed(userId) {
    return this.guesses.has(userId);
  }

  writeForm() {
    if (this.phase !== 'play') return null;
    return {
      title: 'your guess',
      customId: `gm:${this.id}`,
      inputs: [
        {
          id: 'number',
          label: 'A number from 1 to 100',
          placeholder: 'e.g. 42',
          min: 1,
          max: 3
        }
      ]
    };
  }

  submit(userId, fields) {
    if (this.phase !== 'play') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.guesses.has(userId)) return { ok: false, reason: 'already' };

    const raw = String(fields?.number ?? fields ?? '').trim();
    const value = Number(raw);
    if (!/^\d{1,3}$/.test(raw) || !Number.isInteger(value) || value < 1 || value > 100) {
      return { ok: false, reason: 'range' };
    }

    this.guesses.set(userId, value);
    return { ok: true, value };
  }

  scoreRound() {
    const rows = this.active()
      .map((player) => ({
        id: player.id,
        name: player.name,
        guess: this.guesses.get(player.id) ?? null,
        distance: this.guesses.has(player.id) ? Math.abs(this.guesses.get(player.id) - this.secret) : null
      }))
      .sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance || a.guess - b.guess;
      });

    const distances = [...new Set(rows.filter((row) => row.distance !== null).map((row) => row.distance))].sort(
      (a, b) => a - b
    );

    for (const row of rows) {
      row.points = 0;
      if (row.distance === null) continue;

      const player = this.get(row.id);
      player.counters ??= { guesses: 0 };
      player.counters.guesses += 1;

      const rank = distances.indexOf(row.distance);
      if (rank === 0) {
        row.points = NUMBER_POINTS.exact;
        player.flags.add('bullseye');
      } else if (rank === 1) {
        row.points = NUMBER_POINTS.closest;
      } else if (rank === 2) {
        row.points = NUMBER_POINTS.second;
      }

      player.score += row.points;
    }

    this.reveal = { round: this.round, secret: this.secret, rows };
  }

  playView() {
    const total = this.active().length;

    return {
      color: COLORS.play,
      title: `round ${this.round}/${this.rounds} · guess the number`,
      description:
        '**the number is somewhere between 1 and 100.**\n\n' +
        'closest wins 3, second closest gets 1, and an exact hit is worth 5.',
      fields: [{ name: 'guesses in', value: `${bar(this.guesses.size, total)} ${this.guesses.size}/${total}`, inline: false }],
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · one guess each, no takebacks`,
      rows: [[{ id: `nm:${this.id}:write`, label: 'Guess', style: 'primary' }]]
    };
  }

  revealView() {
    const reveal = this.reveal;
    const board = reveal.rows
      .map((row) => {
        if (row.distance === null) return `**${row.name}** · no guess`;
        const off = row.distance === 0 ? 'exact' : `${row.distance} off`;
        return `**${row.name}** · ${row.guess} (${off})${row.points ? ` · +${row.points}` : ''}`;
      })
      .join('\n');

    return {
      color: COLORS.reveal,
      title: `the number was ${reveal.secret}`,
      description: `**${reveal.secret}** · ${reveal.rows.filter((row) => row.distance === 0).length ? 'someone hit it exactly.' : 'nobody hit it exactly.'}`,
      fields: [
        { name: 'the guesses', value: truncate(board, 900), inline: false },
        { name: 'scores', value: scoreLines(this.standings(), { limit: 5 }), inline: false }
      ],
      footer: `next round in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: []
    };
  }

  finalLine() {
    const top = this.standings()[0];
    if (!top || top.score <= 0) return 'nobody guessed anything. the number stays a secret.';
    return `**${top.name}** reads numbers best, with ${top.score} points.`;
  }

  awards() {
    const exact = this.players.filter((player) => player.flags.has('bullseye'));
    return exact.length ? `bullseye · ${exact.map((player) => `**${player.name}**`).join(', ')}` : '';
  }
}
