import {
  RoundGame,
  COLORS,
  bar,
  mmss,
  optionRows,
  pickMany,
  scoreLines,
  shuffle,
  truncate
} from './base.js';

export const TRIVIA_TIMING = { lobby: 3 * 60_000, play: 15_000, reveal: 7_000 };
export const TRIVIA_LIMITS = { minPlayers: 2, maxPlayers: 12, rounds: 5 };
export const TRIVIA_POINTS = { correct: 100, fast: 50, fastWindow: 5_000 };

/**
 * Trivia: one question, four buttons, fifteen seconds. Correct answers are worth
 * 100, and answering inside five seconds adds 50. Nobody waits for the host.
 */
export class TriviaGame extends RoundGame {
  constructor({
    questions,
    rng = Math.random,
    rounds = TRIVIA_LIMITS.rounds,
    ...rest
  }) {
    super({
      ...rest,
      rounds,
      minPlayers: TRIVIA_LIMITS.minPlayers,
      maxPlayers: TRIVIA_LIMITS.maxPlayers,
      playMs: TRIVIA_TIMING.play,
      revealMs: TRIVIA_TIMING.reveal,
      lobbyMs: TRIVIA_TIMING.lobby
    });

    this.kind = 'trivia';
    this.rng = rng;
    this.questions = pickMany(questions, this.rounds, rng);
    this.answers = new Map();
    this.order = [];
    this.startedAt = 0;
    this.reveal = null;
  }

  beginRound() {
    this.question = this.questions[this.round - 1];
    this.order = shuffle([0, 1, 2, 3], this.rng);
    this.answers = new Map();
    this.startedAt = this.clock();
    this.reveal = null;

    for (const player of this.players) {
      player.counters ??= { correct: 0, answers: 0 };
    }
  }

  get correctIndex() {
    return this.order.indexOf(this.question.answer);
  }

  get options() {
    return this.order.map((index) => this.question.options[index]);
  }

  hasActed(userId) {
    return this.answers.has(userId);
  }

  voteLabel(value) {
    const index = Number(value);
    const label = Number.isInteger(index) ? 'ABCD'[index] : null;
    return label ? `${label} · ${this.options[index]}` : String(value);
  }

  /** value is the display index as a string, e.g. "2". */
  vote(userId, value) {
    if (this.phase !== 'play') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.answers.has(userId)) return { ok: false, reason: 'voted' };

    const choice = Number(value);
    if (!Number.isInteger(choice) || choice < 0 || choice >= this.options.length) {
      return { ok: false, reason: 'missing' };
    }

    this.answers.set(userId, { choice, at: this.clock() });
    return { ok: true, choice };
  }

  scoreRound() {
    const correct = this.correctIndex;
    const counts = this.options.map(() => 0);
    const right = [];

    for (const player of this.active()) {
      const answer = this.answers.get(player.id);
      player.counters ??= { correct: 0, answers: 0 };
      player.answers = (player.answers ?? 0) + 1;

      if (!answer) {
        player.counters.answers += 1;
        continue;
      }

      counts[answer.choice] += 1;
      player.counters.answers += 1;

      if (answer.choice !== correct) continue;

      const fast = answer.at - this.startedAt <= TRIVIA_POINTS.fastWindow;
      const gain = TRIVIA_POINTS.correct + (fast ? TRIVIA_POINTS.fast : 0);
      player.score += gain;
      player.counters.correct += 1;
      player.correct = (player.correct ?? 0) + 1;
      right.push(player.name);
    }

    this.reveal = {
      round: this.round,
      question: this.question,
      correct,
      counts,
      right,
      missed: this.active().length - right.length
    };
  }

  finishUp() {
    super.finishUp();
    for (const player of this.players) {
      if ((player.correct ?? 0) >= this.rounds) player.flags.add('perfect');
    }
  }

  playView() {
    const options = this.options.map((text, index) => `**${'ABCD'[index]}** ${truncate(text, 90)}`).join('\n');
    const inCount = this.answers.size;
    const total = this.active().length;

    return {
      color: COLORS.play,
      title: `question ${this.round}/${this.rounds} · ${this.question.category}`,
      description: `**${truncate(this.question.q, 280)}**\n\n${options}`,
      fields: [
        { name: 'answers in', value: `${bar(inCount, total)} ${inCount}/${total}`, inline: false }
      ],
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · +100 for the answer, +50 if you are quick`,
      rows: optionRows({
        ns: 'tr',
        id: this.id,
        options: this.options.map((_, index) => ({ value: String(index), label: 'ABCD'[index] }))
      })
    };
  }

  revealView() {
    const reveal = this.reveal;
    const letter = 'ABCD'[reveal.correct];
    const split = reveal.counts
      .map((count, index) => `${'ABCD'[index]} ${this.options[index]} · ${count}`)
      .join('\n');

    return {
      color: COLORS.reveal,
      title: `the answer · ${letter}`,
      description:
        `**${truncate(reveal.question.q, 240)}**\n\n` +
        `**${letter}** ${reveal.question.options[reveal.question.answer]}\n\n` +
        (reveal.right.length
          ? `${reveal.right.length} of ${this.active().length} got it: ${truncate(reveal.right.join(', '), 200)}`
          : 'nobody got it. the question wins.'),
      fields: [
        { name: 'the split', value: split, inline: false },
        { name: 'scores', value: scoreLines(this.standings(), { limit: 5 }) || 'no points yet', inline: false }
      ],
      footer: reveal.question.fact ? truncate(reveal.question.fact, 200) : `next question in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: []
    };
  }

  finalLine() {
    const top = this.standings()[0];
    if (!top || top.score <= 0) return 'nobody scored. the questions remain undefeated.';
    return `**${top.name}** knew the most, with ${top.score} points.`;
  }

  awards() {
    const perfect = this.players.filter((player) => player.flags.has('perfect'));
    const sharp = [...this.players].sort((a, b) => (b.correct ?? 0) - (a.correct ?? 0))[0];
    const lines = [];
    if (perfect.length) lines.push(`flawless · ${perfect.map((player) => `**${player.name}**`).join(', ')} (${this.rounds}/${this.rounds})`);
    else if (sharp?.correct) lines.push(`closest · **${sharp.name}** (${sharp.correct}/${this.rounds} correct)`);
    return lines.join('\n');
  }
}
