import {
  RoundGame,
  COLORS,
  bar,
  mmss,
  pickMany,
  scoreLines,
  truncate
} from './base.js';

export const WYR_TIMING = { lobby: 3 * 60_000, play: 25_000, reveal: 6_000 };
export const WYR_LIMITS = { minPlayers: 2, maxPlayers: 12, rounds: 4 };

/**
 * Would You Rather: two buttons, no wrong answer, one majority. You score by
 * agreeing with the room, and the room always reveals something about itself.
 */
export class WyrGame extends RoundGame {
  constructor({ prompts, rng = Math.random, rounds = WYR_LIMITS.rounds, ...rest }) {
    super({
      ...rest,
      rounds,
      minPlayers: WYR_LIMITS.minPlayers,
      maxPlayers: WYR_LIMITS.maxPlayers,
      playMs: WYR_TIMING.play,
      revealMs: WYR_TIMING.reveal,
      lobbyMs: WYR_TIMING.lobby
    });

    this.kind = 'wyr';
    this.rng = rng;
    this.prompts = pickMany(prompts, this.rounds, rng);
    this.votes = new Map();
    this.reveal = null;
  }

  beginRound() {
    this.prompt = this.prompts[this.round - 1];
    this.votes = new Map();
    this.reveal = null;
    for (const player of this.players) player.counters ??= { wyr: 0 };
  }

  hasActed(userId) {
    return this.votes.has(userId);
  }

  voteLabel(side) {
    if (!this.prompt) return String(side).toUpperCase();
    return side === 'b' ? `B · ${this.prompt.b}` : `A · ${this.prompt.a}`;
  }

  vote(userId, side) {
    if (this.phase !== 'play') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.votes.has(userId)) return { ok: false, reason: 'voted' };
    if (side !== 'a' && side !== 'b') return { ok: false, reason: 'missing' };

    this.votes.set(userId, side);
    return { ok: true, side };
  }

  scoreRound() {
    const a = [...this.votes.values()].filter((side) => side === 'a').length;
    const b = this.votes.size - a;
    const tie = a === b;
    const majority = tie ? null : a > b ? 'a' : 'b';
    const minority = tie ? null : majority === 'a' ? 'b' : 'a';

    const winners = [];
    const contrarians = [];

    for (const player of this.active()) {
      const side = this.votes.get(player.id);
      player.counters ??= { wyr: 0 };
      if (!side) continue;

      player.counters.wyr += 1;

      if (tie) {
        player.score += 1;
        winners.push(player.name);
      } else if (side === majority) {
        player.score += 2;
        winners.push(player.name);
      } else {
        const sideCount = side === 'a' ? a : b;
        if (sideCount * 4 <= this.votes.size) {
          player.flags.add('contrarian');
          contrarians.push(player.name);
        }
      }
    }

    this.reveal = { round: this.round, prompt: this.prompt, a, b, tie, majority, minority, winners, contrarians };
  }

  playView() {
    const total = this.active().length;

    return {
      color: COLORS.play,
      title: `round ${this.round}/${this.rounds} · would you rather`,
      description:
        `**A** ${truncate(this.prompt.a, 150)}\n` +
        `**B** ${truncate(this.prompt.b, 150)}\n\n` +
        'pick one. majority takes two points; a tie pays everybody one.',
      fields: [{ name: 'votes in', value: `${bar(this.votes.size, total)} ${this.votes.size}/${total}`, inline: false }],
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · your vote is private until the reveal`,
      rows: [
        [
          { id: `wr:${this.id}:v:a`, label: 'A', style: 'primary' },
          { id: `wr:${this.id}:v:b`, label: 'B', style: 'secondary' }
        ]
      ]
    };
  }

  revealView() {
    const reveal = this.reveal;
    const total = Math.max(1, reveal.a + reveal.b);
    const pct = (count) => Math.round((count / total) * 100);

    const line = reveal.tie
      ? 'a perfect split. everyone gets a point.'
      : `the room went **${reveal.majority.toUpperCase()}** · ${reveal.majority === 'a' ? truncate(reveal.prompt.a, 80) : truncate(reveal.prompt.b, 80)}`;

    return {
      color: COLORS.reveal,
      title: `the room has spoken · ${pct(reveal.a)}/${pct(reveal.b)}`,
      description: `**A** ${truncate(reveal.prompt.a, 120)}\n**B** ${truncate(reveal.prompt.b, 120)}\n\n${line}`,
      fields: [
        {
          name: 'the split',
          value: `A · ${reveal.a} (${pct(reveal.a)}%)\nB · ${reveal.b} (${pct(reveal.b)}%)`,
          inline: true
        },
        { name: 'scores', value: scoreLines(this.standings(), { limit: 5 }), inline: true }
      ],
      footer: reveal.prompt.fact
        ? truncate(reveal.prompt.fact, 200)
        : `next round in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: []
    };
  }

  finalLine() {
    const top = this.standings()[0];
    if (!top || top.score <= 0) return 'the room could not agree on anything.';
    return `**${top.name}** agrees with the room more than anyone, on ${top.score} points.`;
  }

  awards() {
    const contrarians = this.players.filter((player) => player.flags.has('contrarian'));
    return contrarians.length
      ? `contrarian · ${contrarians.map((player) => `**${player.name}**`).join(', ')}`
      : '';
  }
}
