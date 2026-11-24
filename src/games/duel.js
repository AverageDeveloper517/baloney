import { RoundGame, COLORS, mmss, scoreLines } from './base.js';

export const DUEL_TIMING = { lobby: 3 * 60_000, play: 20_000, reveal: 5_000 };
export const DUEL_LIMITS = { minPlayers: 2, maxPlayers: 2, rounds: 3 };

const HANDS = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const SYMBOL = { rock: 'rock', paper: 'paper', scissors: 'scissors' };

/**
 * Duel: two players, three rounds, rock-paper-scissors with the picks hidden
 * until both are in. First to two rounds takes the match.
 */
export class DuelGame extends RoundGame {
  constructor({ rng = Math.random, ...rest }) {
    super({
      ...rest,
      rounds: DUEL_LIMITS.rounds,
      minPlayers: DUEL_LIMITS.minPlayers,
      maxPlayers: DUEL_LIMITS.maxPlayers,
      playMs: DUEL_TIMING.play,
      revealMs: DUEL_TIMING.reveal,
      lobbyMs: DUEL_TIMING.lobby
    });

    this.kind = 'duel';
    this.rng = rng;
    this.picks = new Map();
    this.roundWins = new Map();
    this.matchOver = false;
    this.reveal = null;
  }

  beginRound() {
    this.picks = new Map();
    this.reveal = null;
    for (const player of this.players) {
      this.roundWins.set(player.id, this.roundWins.get(player.id) ?? 0);
      player.counters ??= { duelRounds: 0 };
    }
  }

  hasActed(userId) {
    return this.picks.has(userId);
  }

  voteLabel(hand) {
    return String(hand);
  }

  vote(userId, hand) {
    if (this.phase !== 'play') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.picks.has(userId)) return { ok: false, reason: 'voted' };
    if (!HANDS.includes(hand)) return { ok: false, reason: 'missing' };

    this.picks.set(userId, hand);
    return { ok: true, hand };
  }

  scoreRound() {
    const active = this.active();
    const first = active[0];
    const second = active[1];
    const a = first ? this.picks.get(first.id) ?? null : null;
    const b = second ? this.picks.get(second.id) ?? null : null;

    let winner = null;
    let line = 'both hesitated. the round is a draw.';

    if (a && b) {
      if (a === b) {
        line = `both threw **${a}**.`;
      } else if (BEATS[a] === b) {
        winner = first;
        line = `**${a}** beats **${b}**.`;
      } else {
        winner = second;
        line = `**${b}** beats **${a}**.`;
      }
    } else if (a || b) {
      winner = a ? first : second;
      line = `only **${winner?.name ?? 'one player'}** showed up with a hand.`;
    }

    for (const player of active) player.counters ??= { duelRounds: 0 };
    if (winner) {
      winner.score += 1;
      winner.counters.duelRounds += 1;
      this.roundWins.set(winner.id, (this.roundWins.get(winner.id) ?? 0) + 1);
      if ((this.roundWins.get(winner.id) ?? 0) >= 2) this.matchOver = true;
    }

    this.reveal = { round: this.round, a, b, winner: winner?.id ?? null, line, names: active.map((p) => ({ id: p.id, name: p.name, hand: this.picks.get(p.id) ?? null })) };
  }

  nextRound() {
    if (this.phase !== 'reveal') return false;
    if (this.matchOver || this.round >= this.rounds) {
      this.finishUp();
      return true;
    }
    this.begin();
    return true;
  }

  finishUp() {
    const players = [...this.players];
    const top = Math.max(0, ...players.map((player) => this.roundWins.get(player.id) ?? 0));
    const leaders = players.filter((player) => (this.roundWins.get(player.id) ?? 0) === top);

    if (top > 0 && leaders.length === 1) {
      leaders[0].score += 5;
      leaders[0].flags.add('duelist');
      this.matchWinner = leaders[0].id;
    } else {
      this.matchWinner = null;
    }

    super.finishUp();
  }

  playView() {
    const active = this.active();
    const names = active
      .map((player) => `${this.picks.has(player.id) ? '◆' : '◇'} **${player.name}**${this.picks.has(player.id) ? ' is ready' : ' is thinking'}`)
      .join('\n');

    return {
      color: COLORS.play,
      title: `round ${this.round} · duel`,
      description:
        '**rock, paper, scissors.**\n\n' +
        'both picks stay hidden until the round closes. first to two rounds takes the match.',
      fields: [
        { name: 'the duel', value: names, inline: false },
        { name: 'rounds', value: scoreLines(active.map((player) => ({ ...player, score: this.roundWins.get(player.id) ?? 0 })), { limit: 2, unit: ' rounds' }), inline: false }
      ],
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · your pick is secret`,
      rows: [
        HANDS.map((hand) => ({ id: `du:${this.id}:v:${hand}`, label: hand, style: 'primary' }))
      ]
    };
  }

  revealView() {
    const reveal = this.reveal;
    const hands = reveal.names
      .map((row) => `**${row.name}** · ${row.hand ? SYMBOL[row.hand] : 'nothing'}`)
      .join('\n');

    return {
      color: COLORS.reveal,
      title: `round ${reveal.round} · ${reveal.winner ? 'point' : 'draw'}`,
      description: `${reveal.line}\n\n${hands}`,
      fields: [
        {
          name: 'match',
          value: scoreLines(
            this.active().map((player) => ({ ...player, score: this.roundWins.get(player.id) ?? 0 })),
            { limit: 2, unit: ' rounds' }
          ),
          inline: false
        }
      ],
      footer: `next round in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: []
    };
  }

  finalLine() {
    const winner = this.players.find((player) => player.id === this.matchWinner);
    if (winner) return `**${winner.name}** wins the duel, ${this.roundWins.get(winner.id) ?? 0} rounds to ${this.roundWins.get(this.players.find((p) => p.id !== winner.id)?.id) ?? 0}.`;
    return 'the duel ends level. nobody gets bragging rights.';
  }

  awards() {
    return this.matchWinner ? `duelist · **${this.players.find((player) => player.id === this.matchWinner)?.name ?? 'someone'}**` : '';
  }
}
