import {
  LETTERS,
  Lobby,
  COLORS,
  bar,
  clean,
  clamp,
  mmss,
  normalize,
  pickMany,
  renderPrompt,
  scoreLines,
  shuffle,
  truncate
} from './base.js';

export const BLUFF_TIMING = {
  lobby: 5 * 60_000,
  submit: 60_000,
  vote: 45_000,
  reveal: 12_000
};

export const BLUFF_POINTS = { truth: 1_000, fooled: 500 };
export const BLUFF_LIMITS = { minPlayers: 3, maxPlayers: 10, rounds: 3, answerLength: 80 };

/**
 * Bluff: one prompt, one true answer, and a pile of lies written by the room.
 * Vote for the truth. Points for finding it, and points for every stranger who
 * falls for your lie.
 */
export class BluffGame extends Lobby {
  constructor({
    prompts,
    rng = Math.random,
    rounds = BLUFF_LIMITS.rounds,
    minPlayers = BLUFF_LIMITS.minPlayers,
    maxPlayers = BLUFF_LIMITS.maxPlayers,
    ...rest
  }) {
    super({ ...rest, minPlayers, maxPlayers, lobbyMs: BLUFF_TIMING.lobby });

    this.kind = 'bluff';
    this.rng = rng;
    this.rounds = clamp(Number(rounds) || BLUFF_LIMITS.rounds, 1, 5);
    this.prompts = pickMany(prompts, this.rounds, rng);

    this.round = 0;
    this.prompt = null;
    this.submissions = new Map();
    this.options = [];
    this.votes = new Map();
    this.reveal = null;
    this.history = [];
  }

  // --- lifecycle -----------------------------------------------------------

  start() {
    if (this.phase !== 'lobby') return { ok: false, reason: 'phase' };
    if (this.size < this.minPlayers) return { ok: false, reason: 'few' };
    this.beginRound();
    return { ok: true };
  }

  beginRound() {
    this.round += 1;
    this.prompt = this.prompts[this.round - 1];
    this.submissions = new Map();
    this.options = [];
    this.votes = new Map();
    this.reveal = null;
    this.phase = 'submit';
    this.phaseEndsAt = this.clock() + BLUFF_TIMING.submit;
  }

  tick(now = this.clock()) {
    switch (this.phase) {
      case 'lobby':
        this.phase = 'dead';
        this.phaseEndsAt = null;
        return true;
      case 'submit':
        return this.closeSubmissions(now);
      case 'vote':
        return this.closeVotes(now);
      case 'reveal':
        return this.nextRound(now);
      default:
        return false;
    }
  }

  /** Close a phase early when every eligible player has acted. */
  advanceIfReady(now = this.clock()) {
    if (this.phase === 'submit' && this.allSubmitted()) return this.closeSubmissions(now);
    if (this.phase === 'vote' && this.allVoted()) return this.closeVotes(now);
    return false;
  }

  // --- submissions ---------------------------------------------------------

  hadTruth(userId) {
    return Boolean(this.submissions.get(userId)?.truth);
  }

  submittedCount() {
    return this.active().filter((player) => this.submissions.has(player.id)).length;
  }

  allSubmitted() {
    return this.active().every((player) => this.submissions.has(player.id));
  }

  /**
   * A lie is stored once per unique text. Duplicates merge authors, so nobody
   * is punished for thinking like someone else. Writing the actual answer is
   * allowed, but you sit out the vote because you already know it.
   */
  submit(userId, text) {
    if (this.phase !== 'submit') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.submissions.has(userId)) return { ok: false, reason: 'already' };

    const value = clean(text);
    if (value.length < 2) return { ok: false, reason: 'short' };
    if (value.length > BLUFF_LIMITS.answerLength) return { ok: false, reason: 'long' };

    if (normalize(value) === normalize(this.prompt.answer)) {
      this.submissions.set(userId, { text: value, truth: true, authors: new Set([userId]) });
      player.truths = (player.truths ?? 0) + 1;
      return { ok: true, truth: true };
    }

    const twin = [...new Set(this.submissions.values())].find(
      (entry) => !entry.truth && normalize(entry.text) === normalize(value)
    );

    if (twin) {
      twin.authors.add(userId);
      this.submissions.set(userId, twin);
      return { ok: true, merged: true, text: twin.text };
    }

    const entry = { text: value, truth: false, authors: new Set([userId]) };
    this.submissions.set(userId, entry);
    return { ok: true };
  }

  closeSubmissions(now = this.clock()) {
    if (this.phase !== 'submit') return false;

    const seen = new Set();
    const lies = [];
    for (const entry of this.submissions.values()) {
      if (entry.truth || seen.has(entry)) continue;
      seen.add(entry);
      lies.push({ text: entry.text, authors: [...entry.authors], truth: false });
    }

    const options = [{ text: this.prompt.answer, authors: [], truth: true }, ...lies];
    shuffle(options, this.rng);

    this.options = options.map((option, index) => ({
      ...option,
      key: LETTERS[index],
      votes: 0,
      voters: []
    }));

    this.phase = 'vote';
    this.phaseEndsAt = now + BLUFF_TIMING.vote;

    // No lies at all: there is nothing to vote on, so reveal immediately.
    if (!lies.length) {
      this.closeVotes(now, { empty: true });
      return true;
    }

    return true;
  }

  // --- votes ---------------------------------------------------------------

  eligibleVoters() {
    return this.active().filter((player) => !this.hadTruth(player.id));
  }

  votedCount() {
    return this.votes.size;
  }

  allVoted() {
    const voters = this.eligibleVoters();
    return voters.every((player) => this.votes.has(player.id));
  }

  vote(userId, key) {
    if (this.phase !== 'vote') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.hadTruth(userId)) return { ok: false, reason: 'truth' };
    if (this.votes.has(userId)) return { ok: false, reason: 'voted' };

    const option = this.options.find((entry) => entry.key === key);
    if (!option) return { ok: false, reason: 'missing' };
    if (option.authors.includes(userId)) return { ok: false, reason: 'own' };

    this.votes.set(userId, key);
    return { ok: true, key };
  }

  closeVotes(now = this.clock(), { empty = false } = {}) {
    if (this.phase !== 'vote') return false;

    const counts = new Map(this.options.map((option) => [option.key, 0]));
    const voters = new Map(this.options.map((option) => [option.key, []]));

    for (const [userId, key] of this.votes) {
      if (!counts.has(key)) continue;
      counts.set(key, counts.get(key) + 1);
      voters.get(key).push(userId);
    }

    for (const option of this.options) {
      option.votes = counts.get(option.key) ?? 0;
      option.voters = voters.get(option.key) ?? [];

      if (option.truth) {
        for (const userId of option.voters) {
          const player = this.get(userId);
          if (!player) continue;
          player.score += BLUFF_POINTS.truth;
          player.found = (player.found ?? 0) + 1;
        }
        continue;
      }

      for (const authorId of option.authors) {
        const player = this.get(authorId);
        if (!player) continue;
        player.score += BLUFF_POINTS.fooled * option.votes;
        player.fooled = (player.fooled ?? 0) + option.votes;
        player.best = Math.max(player.best ?? 0, option.votes);
      }
    }

    const truth = this.options.find((option) => option.truth);
    this.reveal = {
      round: this.round,
      prompt: this.prompt,
      options: this.options,
      truthKey: truth?.key ?? 'A',
      found: truth?.votes ?? 0,
      empty,
      satOut: this.active()
        .filter((player) => !this.votes.has(player.id) && !this.hadTruth(player.id))
        .map((player) => player.name)
    };

    this.history.push(this.reveal);
    this.phase = 'reveal';
    this.phaseEndsAt = now + BLUFF_TIMING.reveal;
    return true;
  }

  nextRound(now = this.clock()) {
    if (this.phase !== 'reveal') return false;

    if (this.round >= this.rounds) {
      this.phase = 'done';
      this.phaseEndsAt = null;
      return true;
    }

    this.beginRound();
    void now;
    return true;
  }

  // --- results -------------------------------------------------------------

  standings() {
    return [...this.players].sort(
      (a, b) =>
        b.score - a.score ||
        (b.fooled ?? 0) - (a.fooled ?? 0) ||
        (b.found ?? 0) - (a.found ?? 0) ||
        a.name.localeCompare(b.name)
    );
  }

  awards() {
    const players = this.players;
    const biggest = [...players].sort((a, b) => (b.best ?? 0) - (a.best ?? 0))[0];
    const sharpest = [...players].sort((a, b) => (b.found ?? 0) - (a.found ?? 0))[0];
    const lines = [];

    if (biggest?.best) lines.push(`biggest liar · **${biggest.name}** (${biggest.best} vote${biggest.best === 1 ? '' : 's'} on one lie)`);
    if (sharpest?.found) lines.push(`sharpest · **${sharpest.name}** (${sharpest.found} truth${sharpest.found === 1 ? '' : 's'} found)`);

    return lines.length ? lines.join('\n') : 'nobody fooled anybody. suspicious.';
  }

  // --- views ---------------------------------------------------------------

  view() {
    if (this.phase === 'dead') {
      return this.closedView('nobody started', 'the lobby timed out before three players joined. no harm done.');
    }
    if (this.phase === 'done') return this.finalView();

    switch (this.phase) {
      case 'submit':
        return this.submitView();
      case 'vote':
        return this.voteView();
      case 'reveal':
        return this.revealView();
      default:
        return this.lobbyView();
    }
  }

  lobbyView() {
    const host = this.host?.name ?? 'nobody';
    const names = this.players.length
      ? this.players.map((player) => (player.id === this.hostId ? `**${player.name}** · host` : player.name)).join('\n')
      : 'nobody yet';

    return {
      color: COLORS.lobby,
      title: 'Baloney · lobby',
      description:
        '**bluff the room.** one prompt has a real answer; everything else is a lie written by a player.\n\n' +
        'write a lie that sounds true. then vote for the answer you think is real.',
      fields: [
        { name: `players · ${this.size}/${this.maxPlayers}`, value: names, inline: false },
        {
          name: 'the shape of it',
          value: `${this.rounds} rounds · 60s to write · 45s to vote\n3–10 players · no setup, no accounts`,
          inline: false
        }
      ],
      footer: `host: ${host} · lobby closes in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: [
        [
          { id: `bl:${this.id}:join`, label: 'Join', style: 'success', disabled: this.full },
          { id: `bl:${this.id}:leave`, label: 'Leave', style: 'secondary' },
          { id: `bl:${this.id}:start`, label: 'Start', style: 'primary', disabled: this.size < this.minPlayers },
          { id: `bl:${this.id}:cancel`, label: 'Cancel', style: 'danger' }
        ]
      ]
    };
  }

  submitView() {
    const total = this.active().length;
    const inCount = this.submittedCount();
    const waiting = this.active()
      .filter((player) => !this.submissions.has(player.id))
      .map((player) => player.name);

    const fields = [
      {
        name: 'answers in',
        value: `${bar(inCount, total)} ${inCount}/${total}`,
        inline: false
      }
    ];

    if (waiting.length) {
      fields.push({ name: 'still thinking', value: truncate(waiting.join(', '), 200), inline: false });
    }

    return {
      color: COLORS.submit,
      title: `round ${this.round}/${this.rounds} · write a lie`,
      description: `**${renderPrompt(this.prompt.prompt)}**\n\nmake up an answer that sounds real. don't look it up.`,
      fields,
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · answers stay private until the vote`,
      rows: [[{ id: `bl:${this.id}:write`, label: 'Write a lie', style: 'primary' }]]
    };
  }

  voteView() {
    const options = this.options
      .map((option) => `**${option.key}** ${truncate(option.text, 70)}`)
      .join('\n');
    const voters = this.eligibleVoters().length;

    return {
      color: COLORS.vote,
      title: `round ${this.round}/${this.rounds} · find the truth`,
      description: `**${renderPrompt(this.prompt.prompt)}**\n\none of these is the real answer. the rest are lies.`,
      fields: [
        { name: 'the options', value: options, inline: false },
        { name: 'votes in', value: `${bar(this.votes.size, voters)} ${this.votes.size}/${voters}`, inline: false }
      ],
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · you cannot vote for your own lie`,
      rows: chunk(
        this.options.map((option) => ({
          id: `bl:${this.id}:v:${option.key}`,
          label: option.key,
          style: 'secondary'
        })),
        5
      )
    };
  }

  revealView() {
    const reveal = this.reveal;
    const truth = reveal.options.find((option) => option.key === reveal.truthKey);
    const board = reveal.options
      .map((option) => {
        const votes = `${option.votes} vote${option.votes === 1 ? '' : 's'}`;
        const who = option.truth
          ? '**the truth**'
          : option.authors.length
            ? `by ${this.nameOf(option.authors[0])}${option.authors.length > 1 ? ` +${option.authors.length - 1}` : ''}`
            : 'unknown';
        return `**${option.key}** ${truncate(option.text, 44)} — ${votes} · ${who}`;
      })
      .join('\n');

    const description = reveal.empty
      ? `**${renderPrompt(reveal.prompt.prompt)}**\n\nnobody wrote a lie this round. the answer was **${truth?.text}**.`
      : `**${renderPrompt(reveal.prompt.prompt)}**\n\n**the truth:** ${truth?.text ?? '—'} · ${reveal.found} player${reveal.found === 1 ? '' : 's'} found it.`;

    const fields = [
      { name: 'the board', value: board, inline: false },
      { name: 'scores', value: scoreLines(this.standings(), { limit: 5 }) || 'no points yet', inline: false }
    ];

    if (reveal.prompt.fact) fields.push({ name: 'why it is true', value: truncate(reveal.prompt.fact, 300), inline: false });

    return {
      color: COLORS.reveal,
      title: `round ${reveal.round}/${this.rounds} · the answer`,
      description,
      fields,
      footer: `next round in ${mmss(this.phaseEndsAt - this.clock())}${
        reveal.satOut.length ? ` · sat out: ${truncate(reveal.satOut.join(', '), 80)}` : ''
      }`,
      rows: []
    };
  }

  finalView() {
    const standings = this.standings();
    const winners = standings.filter((player) => player.score === standings[0].score && player.score > 0);
    const line = winners.length
      ? winners.length === 1
        ? `**${winners[0].name}** wins with ${winners[0].score} points.`
        : `${winners.map((player) => `**${player.name}**`).join(' and ')} tie on ${winners[0].score}.`
      : 'nobody scored. the room lied to itself.';

    return {
      color: COLORS.final,
      title: 'the standings',
      description: `${line}\n\n${this.rounds} rounds, ${this.players.length} players, 0 facts checked.`,
      fields: [
        { name: 'final', value: scoreLines(standings, { limit: 10 }), inline: false },
        { name: 'awards', value: this.awards(), inline: false }
      ],
      footer: 'the whole game lived in this one message',
      rows: [],
      invite: true
    };
  }

  nameOf(userId) {
    return this.get(userId)?.name ?? 'someone';
  }
}

/** Split buttons into rows of at most five, which is Discord's limit. */
export function chunk(list, size) {
  const rows = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}
