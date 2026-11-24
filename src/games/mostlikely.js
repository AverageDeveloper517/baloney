import { Lobby, COLORS, bar, clamp, mmss, pickMany, scoreLines, truncate } from './base.js';
import { chunk } from './bluff.js';

export const ML_TIMING = { lobby: 5 * 60_000, vote: 35_000, reveal: 9_000 };
export const ML_LIMITS = { minPlayers: 3, maxPlayers: 10, rounds: 3 };

/**
 * Most Likely To: no typing, one tap per round. The room votes for the person
 * who best fits a situation. It exists as the 30-second on-ramp to the bot.
 */
export class MostLikelyGame extends Lobby {
  constructor({
    situations,
    rng = Math.random,
    rounds = ML_LIMITS.rounds,
    minPlayers = ML_LIMITS.minPlayers,
    maxPlayers = ML_LIMITS.maxPlayers,
    ...rest
  }) {
    super({ ...rest, minPlayers, maxPlayers, lobbyMs: ML_TIMING.lobby });

    this.kind = 'mostlikely';
    this.rng = rng;
    this.rounds = clamp(Number(rounds) || ML_LIMITS.rounds, 1, 5);
    this.questions = pickMany(situations, this.rounds, rng);

    this.round = 0;
    this.question = null;
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
    this.question = this.questions[this.round - 1];
    this.votes = new Map();
    this.reveal = null;
    this.phase = 'vote';
    this.phaseEndsAt = this.clock() + ML_TIMING.vote;
  }

  tick(now = this.clock()) {
    switch (this.phase) {
      case 'lobby':
        this.phase = 'dead';
        this.phaseEndsAt = null;
        return true;
      case 'vote':
        return this.closeVotes(now);
      case 'reveal':
        return this.nextRound();
      default:
        return false;
    }
  }

  advanceIfReady(now = this.clock()) {
    if (this.phase === 'vote' && this.allVoted()) return this.closeVotes(now);
    return false;
  }

  voters() {
    return this.active();
  }

  allVoted() {
    return this.voters().every((player) => this.votes.has(player.id));
  }

  vote(voterId, targetId) {
    if (this.phase !== 'vote') return { ok: false, reason: 'phase' };

    const voter = this.get(voterId);
    if (!voter || voter.left) return { ok: false, reason: 'player' };
    if (voterId === targetId) return { ok: false, reason: 'self' };
    if (this.votes.has(voterId)) return { ok: false, reason: 'voted' };

    const target = this.get(targetId);
    if (!target || target.left) return { ok: false, reason: 'target' };

    this.votes.set(voterId, targetId);
    return { ok: true };
  }

  closeVotes(now = this.clock()) {
    if (this.phase !== 'vote') return false;

    const counts = new Map(this.players.map((player) => [player.id, 0]));
    for (const targetId of this.votes.values()) {
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }

    const high = Math.max(0, ...counts.values());
    const winners = high > 0 ? this.players.filter((player) => counts.get(player.id) === high) : [];
    for (const winner of winners) winner.score += 1;

    this.reveal = {
      round: this.round,
      question: this.question,
      counts: this.players
        .map((player) => ({ id: player.id, name: player.name, votes: counts.get(player.id) ?? 0 }))
        .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name)),
      winners: winners.map((player) => player.name),
      high
    };

    this.history.push(this.reveal);
    this.phase = 'reveal';
    this.phaseEndsAt = now + ML_TIMING.reveal;
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

  standings() {
    return [...this.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  view() {
    if (this.phase === 'dead') {
      return this.closedView('nobody started', 'the lobby timed out before three players joined. no harm done.');
    }
    if (this.phase === 'done') return this.finalView();

    switch (this.phase) {
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
      title: 'Baloney · most likely to',
      description:
        '**no typing, no thinking.** one situation, one tap.\n\nthe room votes for the person who fits it best. majority takes the point.',
      fields: [
        { name: `players · ${this.size}/${this.maxPlayers}`, value: names, inline: false },
        { name: 'the shape of it', value: `${this.rounds} rounds · 35s to vote\n3–10 players · about 2 minutes total`, inline: false }
      ],
      footer: `host: ${host} · lobby closes in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: [
        [
          { id: `ml:${this.id}:join`, label: 'Join', style: 'success', disabled: this.full },
          { id: `ml:${this.id}:leave`, label: 'Leave', style: 'secondary' },
          { id: `ml:${this.id}:start`, label: 'Start', style: 'primary', disabled: this.size < this.minPlayers },
          { id: `ml:${this.id}:cancel`, label: 'Cancel', style: 'danger' }
        ]
      ]
    };
  }

  voteView() {
    const active = this.active();
    const rows = chunk(
      active.map((player) => ({
        id: `ml:${this.id}:v:${player.id}`,
        label: truncate(player.name, 32),
        style: 'secondary'
      })),
      5
    );

    return {
      color: COLORS.vote,
      title: `round ${this.round}/${this.rounds} · most likely to`,
      description: `**most likely to ${this.question}**\n\npick one player. you cannot pick yourself.`,
      fields: [
        { name: 'votes in', value: `${bar(this.votes.size, active.length)} ${this.votes.size}/${active.length}`, inline: false }
      ],
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · your vote is private`,
      rows
    };
  }

  revealView() {
    const reveal = this.reveal;
    const counts = reveal.counts
      .map((row) => `${row.votes === reveal.high && reveal.high > 0 ? '◆' : '◇'} **${row.name}** · ${row.votes}`)
      .join('\n');

    const line = !reveal.high
      ? 'nobody voted. bold.'
      : reveal.winners.length === 1
        ? `the room says **${reveal.winners[0]}**.`
        : `the room cannot decide: ${reveal.winners.map((name) => `**${name}**`).join(', ')}.`;

    return {
      color: COLORS.reveal,
      title: `round ${reveal.round}/${this.rounds} · the room has spoken`,
      description: `**most likely to ${reveal.question}**\n\n${line}`,
      fields: [
        { name: 'the votes', value: counts, inline: false },
        { name: 'scores', value: scoreLines(this.standings(), { limit: 5 }), inline: false }
      ],
      footer: `next round in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: []
    };
  }

  finalView() {
    const standings = this.standings();
    const top = standings[0]?.score ?? 0;
    const winners = standings.filter((player) => player.score === top && top > 0);

    const line = winners.length
      ? winners.length === 1
        ? `**${winners[0].name}** is the room's favourite.`
        : `${winners.map((player) => `**${player.name}**`).join(' and ')} share the crown.`
      : 'the room refused to commit.';

    return {
      color: COLORS.final,
      title: 'the standings',
      description: `${line}\n\n${this.rounds} rounds, ${this.players.length} players, zero evidence.`,
      fields: [{ name: 'final', value: scoreLines(standings, { limit: 10 }), inline: false }],
      footer: 'the whole game lived in this one message',
      rows: [],
      invite: true
    };
  }
}
