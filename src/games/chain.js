import { Lobby, COLORS, bar, mmss, pickMany, scoreLines, shuffle, truncate } from './base.js';

export const CHAIN_TIMING = { lobby: 3 * 60_000, submit: 75_000, vote: 40_000, reveal: 10_000 };
export const CHAIN_LIMITS = { minPlayers: 3, maxPlayers: 10, rounds: 2, lineLength: 140 };

/**
 * Chain Story: an opening line, then one sentence from everyone. The room votes
 * for the best contribution and the winner's line becomes the next opening.
 */
export class ChainGame extends Lobby {
  constructor({ openers, rng = Math.random, rounds = CHAIN_LIMITS.rounds, ...rest }) {
    super({
      ...rest,
      rounds,
      minPlayers: CHAIN_LIMITS.minPlayers,
      maxPlayers: CHAIN_LIMITS.maxPlayers,
      lobbyMs: CHAIN_TIMING.lobby
    });

    this.kind = 'chain';
    this.rng = rng;
    this.rounds = Math.min(4, Math.max(1, Number(rounds) || CHAIN_LIMITS.rounds));
    this.openers = pickMany(openers, this.rounds, rng);

    this.round = 0;
    this.story = [];
    this.lines = new Map();
    this.options = [];
    this.votes = new Map();
    this.reveal = null;
    this.history = [];
  }

  start() {
    if (this.phase !== 'lobby') return { ok: false, reason: 'phase' };
    if (this.size < this.minPlayers) return { ok: false, reason: 'few' };
    this.beginRound();
    return { ok: true };
  }

  beginRound() {
    this.round += 1;
    this.lines = new Map();
    this.options = [];
    this.votes = new Map();
    this.reveal = null;
    this.phase = 'submit';
    this.phaseEndsAt = this.clock() + this.ms(CHAIN_TIMING.submit);
  }

  get opener() {
    return this.round <= this.openers.length ? this.openers[this.round - 1] : this.openers[0];
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
        return this.nextRound();
      default:
        return false;
    }
  }

  advanceIfReady(now = this.clock()) {
    if (this.phase === 'submit' && this.allSubmitted()) return this.closeSubmissions(now);
    if (this.phase === 'vote' && this.allVoted()) return this.closeVotes(now);
    return false;
  }

  writeForm() {
    if (this.phase !== 'submit') return null;
    return {
      title: 'your line',
      customId: `gm:${this.id}`,
      inputs: [
        {
          id: 'line',
          label: 'Add the next sentence',
          placeholder: 'one sentence, make it count',
          min: 3,
          max: CHAIN_LIMITS.lineLength,
          paragraph: true
        }
      ]
    };
  }

  submit(userId, input) {
    if (this.phase !== 'submit') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.lines.has(userId)) return { ok: false, reason: 'already' };

    const text = truncate(typeof input === 'string' ? input : input?.line, CHAIN_LIMITS.lineLength);
    if (text.length < 3) return { ok: false, reason: 'short' };

    this.lines.set(userId, text);
    return { ok: true };
  }

  submittedCount() {
    return this.active().filter((player) => this.lines.has(player.id)).length;
  }

  allSubmitted() {
    return this.active().every((player) => this.lines.has(player.id));
  }

  closeSubmissions(now = this.clock()) {
    if (this.phase !== 'submit') return false;

    const options = shuffle(
      [...this.lines.entries()].map(([authorId, text]) => ({ authorId, text, votes: 0, voters: [] })),
      this.rng
    ).map((option, index) => ({ ...option, key: 'ABCDEFGHIJK'[index] }));

    this.options = options;
    this.phase = 'vote';
    this.phaseEndsAt = now + this.ms(CHAIN_TIMING.vote);

    if (options.length < 2) {
      this.closeVotes(now, { thin: true });
      return true;
    }

    return true;
  }

  eligibleVoters() {
    return this.active().filter((player) => this.options.some((option) => option.authorId !== player.id));
  }

  votedCount() {
    return this.votes.size;
  }

  allVoted() {
    return this.eligibleVoters().every((player) => this.votes.has(player.id));
  }

  vote(userId, key) {
    if (this.phase !== 'vote') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.votes.has(userId)) return { ok: false, reason: 'voted' };

    const option = this.options.find((entry) => entry.key === key);
    if (!option) return { ok: false, reason: 'missing' };
    if (option.authorId === userId) return { ok: false, reason: 'own' };

    this.votes.set(userId, key);
    return { ok: true, key };
  }

  voteLabel(key) {
    const option = this.options.find((entry) => entry.key === key);
    return option ? `${option.key} · ${option.text}` : String(key);
  }

  closeVotes(now = this.clock(), { thin = false } = {}) {
    if (this.phase !== 'vote') return false;

    for (const option of this.options) {
      option.votes = 0;
      option.voters = [];
    }

    for (const [userId, key] of this.votes) {
      const option = this.options.find((entry) => entry.key === key);
      if (!option) continue;
      option.votes += 1;
      option.voters.push(userId);

      const player = this.get(option.authorId);
      if (!player) continue;
      player.score += 2;
      player.lines = (player.lines ?? 0) + 1;
    }

    const top = Math.max(0, ...this.options.map((option) => option.votes));
    const best = top > 0 ? this.options.filter((option) => option.votes === top) : [];
    for (const option of best) {
      const player = this.get(option.authorId);
      player?.flags.add('crowd-pleaser');
    }

    if (best.length) this.story.push(best[0].text);

    this.reveal = {
      round: this.round,
      opener: this.opener,
      options: this.options,
      thin,
      best: best.map((option) => option.authorId)
    };

    this.history.push(this.reveal);
    this.phase = 'reveal';
    this.phaseEndsAt = now + this.ms(CHAIN_TIMING.reveal);
    return true;
  }

  nextRound() {
    if (this.phase !== 'reveal') return false;
    if (this.round >= this.rounds) {
      this.phase = 'done';
      this.phaseEndsAt = null;
      return true;
    }
    this.beginRound();
    return true;
  }

  view() {
    if (this.phase === 'dead') {
      return this.closedView('nobody started', 'the lobby timed out before three players joined.');
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

  storyBlock() {
    return this.story.length ? `\n\n*so far:* ${truncate(this.story.join(' '), 320)}` : '';
  }

  lobbyView() {
    const host = this.host?.name ?? 'nobody';
    const names = this.players.length
      ? this.players.map((player) => (player.id === this.hostId ? `**${player.name}** · host` : player.name)).join('\n')
      : 'nobody yet';

    return {
      color: COLORS.lobby,
      title: 'chain story · lobby',
      description:
        '**one sentence each.** the opening line is given; everyone adds the next sentence.\\n\\n' +
        'then the room votes for the best line, and the winner becomes the next opening.',
      fields: [
        { name: `players · ${this.size}/${this.maxPlayers}`, value: names, inline: false },
        { name: 'the shape of it', value: `${this.rounds} rounds · 75s to write · 40s to vote\\n3–10 players`, inline: false }
      ],
      footer: `host: ${host} · lobby closes in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: [
        [
          { id: `ch:${this.id}:join`, label: 'Join', style: 'success', disabled: this.full },
          { id: `ch:${this.id}:leave`, label: 'Leave', style: 'secondary' },
          { id: `ch:${this.id}:start`, label: 'Start', style: 'primary', disabled: this.size < this.minPlayers },
          { id: `ch:${this.id}:cancel`, label: 'Cancel', style: 'danger' }
        ]
      ]
    };
  }

  submitView() {
    const total = this.active().length;
    const inCount = this.submittedCount();
    const waiting = this.active()
      .filter((player) => !this.lines.has(player.id))
      .map((player) => player.name);

    const fields = [{ name: 'lines in', value: `${bar(inCount, total)} ${inCount}/${total}`, inline: false }];
    if (waiting.length) fields.push({ name: 'still writing', value: truncate(waiting.join(', '), 200), inline: false });

    return {
      color: COLORS.play,
      title: `round ${this.round}/${this.rounds} · add a sentence`,
      description: `**${truncate(this.opener, 280)}**${this.storyBlock()}\n\nwrite the next sentence. nobody sees it until the vote.`,
      fields,
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · ${CHAIN_LIMITS.lineLength} characters max`,
      rows: [[{ id: `ch:${this.id}:write`, label: 'Add a line', style: 'primary' }]]
    };
  }

  voteView() {
    const options = this.options
      .map((option) => `**${option.key}** ${truncate(option.text, 90)}`)
      .join('\n');
    const voters = this.eligibleVoters().length;

    return {
      color: COLORS.vote,
      title: `round ${this.round}/${this.rounds} · best line`,
      description: `**${truncate(this.opener, 240)}**${this.storyBlock()}\n\nwhich line belongs in the story?`,
      fields: [
        { name: 'the lines', value: options || 'nothing to vote on', inline: false },
        { name: 'votes in', value: `${bar(this.votes.size, voters)} ${this.votes.size}/${voters}`, inline: false }
      ],
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · you cannot vote for your own line`,
      rows: this.options.slice(0, 10).reduce((rows, option, index) => {
        if (index % 5 === 0) rows.push([]);
        rows.at(-1).push({ id: `ch:${this.id}:v:${option.key}`, label: option.key, style: 'secondary' });
        return rows;
      }, [])
    };
  }

  revealView() {
    const reveal = this.reveal;
    const board = reveal.options
      .map((option) => {
        const who = this.get(option.authorId)?.name ?? 'someone';
        return `**${option.key}** ${truncate(option.text, 70)} — ${option.votes} vote${option.votes === 1 ? '' : 's'} · ${who}`;
      })
      .join('\n');

    const winners = reveal.best.map((id) => this.get(id)?.name).filter(Boolean);
    const line = reveal.thin
      ? 'not enough lines to vote on. the round passes.'
      : winners.length
        ? `the room picked **${winners.join(' and ')}**.`
        : 'nobody voted. the story stalls.';

    return {
      color: COLORS.reveal,
      title: `round ${reveal.round}/${this.rounds} · the best line`,
      description: `**${truncate(reveal.opener, 200)}**\n\n${line}`,
      fields: [
        { name: 'the lines', value: board || 'nothing', inline: false },
        { name: 'scores', value: scoreLines(this.standings(), { limit: 5 }), inline: false }
      ],
      footer: `next round in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: []
    };
  }

  finalLine() {
    const top = this.standings()[0];
    if (!top || top.score <= 0) return 'nobody wrote anything worth voting for.';
    return `**${top.name}** wrote the room's favourite lines, with ${top.score} points.`;
  }

  awards() {
    const stars = this.players.filter((player) => player.flags.has('crowd-pleaser'));
    return stars.length ? `crowd pleaser · ${stars.map((player) => `**${player.name}**`).join(', ')}` : '';
  }
}
