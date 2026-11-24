import {
  Lobby,
  COLORS,
  bar,
  clean,
  mmss,
  normalize,
  pickOne,
  plural,
  scoreLines,
  truncate
} from './base.js';

export const IMPOSTOR_TIMING = { lobby: 3 * 60_000, brief: 25_000, clue: 60_000, vote: 30_000, reveal: 10_000 };
export const IMPOSTOR_LIMITS = { minPlayers: 3, maxPlayers: 10, rounds: 2, clueLength: 24 };

/**
 * Impostor: everyone gets the same word except one player, who gets a related
 * word. Everyone writes a one-word clue, then the room votes for the odd one out.
 */
export class ImpostorGame extends Lobby {
  constructor({ pairs, rng = Math.random, rounds = IMPOSTOR_LIMITS.rounds, ...rest }) {
    super({
      ...rest,
      rounds,
      minPlayers: IMPOSTOR_LIMITS.minPlayers,
      maxPlayers: IMPOSTOR_LIMITS.maxPlayers,
      lobbyMs: IMPOSTOR_TIMING.lobby
    });

    this.kind = 'impostor';
    this.rng = rng;
    this.rounds = Math.min(4, Math.max(1, Number(rounds) || IMPOSTOR_LIMITS.rounds));
    this.pairs = pairs;

    this.round = 0;
    this.pair = null;
    this.impostorId = null;
    this.words = new Map();
    this.seen = new Set();
    this.clues = new Map();
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
    this.pair = pickOne(this.pairs, this.rng);
    this.impostorId = pickOne(this.active(), this.rng)?.id ?? this.hostId;
    this.words = new Map(
      this.players.map((player) => [player.id, player.id === this.impostorId ? this.pair.impostor : this.pair.civilian])
    );
    this.seen = new Set();
    this.clues = new Map();
    this.votes = new Map();
    this.reveal = null;
    this.phase = 'brief';
    this.phaseEndsAt = this.clock() + this.ms(IMPOSTOR_TIMING.brief);
  }

  /** Shown only to the asking player, in an ephemeral reply. */
  secret(userId) {
    if (!this.get(userId)) return null;
    return this.words.get(userId) ?? null;
  }

  markSeen(userId) {
    if (this.phase !== 'brief' || !this.get(userId)) return false;
    this.seen.add(userId);
    return true;
  }

  tick(now = this.clock()) {
    switch (this.phase) {
      case 'lobby':
        this.phase = 'dead';
        this.phaseEndsAt = null;
        return true;
      case 'brief':
        return this.startClues(now);
      case 'clue':
        return this.startVote(now);
      case 'vote':
        return this.resolve(now);
      case 'reveal':
        return this.nextRound();
      default:
        return false;
    }
  }

  advanceIfReady(now = this.clock()) {
    if (this.phase === 'brief' && this.active().every((player) => this.seen.has(player.id))) {
      return this.startClues(now);
    }
    if (this.phase === 'clue' && this.active().every((player) => this.clues.has(player.id))) {
      return this.startVote(now);
    }
    if (this.phase === 'vote' && this.active().every((player) => this.votes.has(player.id))) {
      return this.resolve(now);
    }
    return false;
  }

  startClues(now = this.clock()) {
    if (this.phase !== 'brief') return false;
    this.phase = 'clue';
    this.phaseEndsAt = now + this.ms(IMPOSTOR_TIMING.clue);
    return true;
  }

  startVote(now = this.clock()) {
    if (this.phase !== 'clue') return false;
    this.phase = 'vote';
    this.phaseEndsAt = now + this.ms(IMPOSTOR_TIMING.vote);
    return true;
  }

  writeForm() {
    if (this.phase !== 'clue') return null;
    return {
      title: 'your clue',
      customId: `gm:${this.id}`,
      inputs: [
        {
          id: 'clue',
          label: 'One word that points at your word',
          placeholder: 'subtle, not obvious',
          min: 1,
          max: IMPOSTOR_LIMITS.clueLength
        }
      ]
    };
  }

  submit(userId, fields) {
    if (this.phase !== 'clue') return { ok: false, reason: 'phase' };

    const player = this.get(userId);
    if (!player || player.left) return { ok: false, reason: 'player' };
    if (this.clues.has(userId)) return { ok: false, reason: 'already' };

    const clue = clean(typeof fields === 'string' ? fields : fields?.clue);
    if (!clue) return { ok: false, reason: 'short' };
    if (clue.length > IMPOSTOR_LIMITS.clueLength) return { ok: false, reason: 'long' };
    if (normalize(clue) === normalize(this.words.get(userId))) return { ok: false, reason: 'word' };

    this.clues.set(userId, clue);
    return { ok: true };
  }

  vote(userId, targetId) {
    if (this.phase !== 'vote') return { ok: false, reason: 'phase' };

    const voter = this.get(userId);
    if (!voter || voter.left) return { ok: false, reason: 'player' };
    if (this.votes.has(userId)) return { ok: false, reason: 'voted' };
    if (userId === targetId) return { ok: false, reason: 'self' };

    const target = this.get(targetId);
    if (!target || target.left) return { ok: false, reason: 'target' };

    this.votes.set(userId, targetId);
    return { ok: true };
  }

  voteLabel(targetId) {
    return this.get(targetId)?.name ?? String(targetId);
  }

  resolve(now = this.clock()) {
    if (this.phase !== 'vote') return false;

    const counts = new Map(this.players.map((player) => [player.id, 0]));
    for (const targetId of this.votes.values()) {
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }

    const impostorVotes = counts.get(this.impostorId) ?? 0;
    const others = [...counts.entries()].filter(([id]) => id !== this.impostorId);
    const bestOther = Math.max(0, ...others.map(([, count]) => count));
    const caught = impostorVotes > 0 && impostorVotes > bestOther;

    for (const [voterId, targetId] of this.votes) {
      const player = this.get(voterId);
      if (!player) continue;
      player.counters ??= { impostorVotes: 0 };
      player.counters.impostorVotes += 1;

      if (!caught) continue;
      if (targetId !== this.impostorId) continue;

      player.score += 2;
      player.flags.add('caught');
    }

    const impostor = this.get(this.impostorId);
    if (!caught && impostor) {
      impostor.score += 4;
      impostor.flags.add('slipped');
    }

    this.reveal = {
      round: this.round,
      pair: this.pair,
      impostorId: this.impostorId,
      impostorName: impostor?.name ?? 'someone',
      caught,
      counts,
      impostorVotes,
      bestOther,
      votes: [...this.votes.entries()],
      clues: [...this.clues.entries()].map(([id, clue]) => ({ id, name: this.get(id)?.name ?? 'someone', clue }))
    };

    this.history.push(this.reveal);
    this.phase = 'reveal';
    this.phaseEndsAt = now + this.ms(IMPOSTOR_TIMING.reveal);
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
      case 'brief':
        return this.briefView();
      case 'clue':
        return this.clueView();
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
      title: 'impostor · lobby',
      description:
        '**one of you has a different word.**\n\n' +
        'everyone writes a one-word clue about their word. then the room votes for whoever sounds like they are faking it.',
      fields: [
        { name: `players · ${this.size}/${this.maxPlayers}`, value: names, inline: false },
        { name: 'the shape of it', value: `${this.rounds} rounds · 25s to read · 60s to write · 30s to vote\n3–10 players`, inline: false }
      ],
      footer: `host: ${host} · lobby closes in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: [
        [
          { id: `im:${this.id}:join`, label: 'Join', style: 'success', disabled: this.full },
          { id: `im:${this.id}:leave`, label: 'Leave', style: 'secondary' },
          { id: `im:${this.id}:start`, label: 'Start', style: 'primary', disabled: this.size < this.minPlayers },
          { id: `im:${this.id}:cancel`, label: 'Cancel', style: 'danger' }
        ]
      ]
    };
  }

  briefView() {
    const ready = this.active().filter((player) => this.seen.has(player.id)).length;
    return {
      color: COLORS.play,
      title: `round ${this.round}/${this.rounds} · your word`,
      description:
        '**check your word, then keep it to yourself.**\n\n' +
        'press the button below. the reply is private. then write a one-word clue that proves you know the word without saying it.',
      fields: [
        { name: 'words opened', value: `${bar(ready, this.active().length)} ${ready}/${this.active().length}`, inline: false }
      ],
      footer: `clues open in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: [[{ id: `im:${this.id}:word`, label: 'Show my word', style: 'primary' }]]
    };
  }

  clueView() {
    const inCount = this.clues.size;
    const total = this.active().length;
    const waiting = this.active()
      .filter((player) => !this.clues.has(player.id))
      .map((player) => player.name);

    const fields = [{ name: 'clues in', value: `${bar(inCount, total)} ${inCount}/${total}`, inline: false }];
    if (waiting.length) fields.push({ name: 'still thinking', value: truncate(waiting.join(', '), 200), inline: false });

    return {
      color: COLORS.play,
      title: `round ${this.round}/${this.rounds} · write a clue`,
      description: '**one word.** close enough that the room believes you, vague enough that the impostor cannot copy you.',
      fields,
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · ${IMPOSTOR_LIMITS.clueLength} characters max`,
      rows: [[{ id: `im:${this.id}:write`, label: 'Write a clue', style: 'primary' }]]
    };
  }

  voteView() {
    const board = this.active()
      .map((player) => `**${player.name}** · ${truncate(this.clues.get(player.id) ?? 'no clue', 40)}`)
      .join('\n');

    const rows = [];
    const active = this.active();
    for (let i = 0; i < active.length; i += 5) {
      rows.push(
        active.slice(i, i + 5).map((player) => ({
          id: `im:${this.id}:v:${player.id}`,
          label: truncate(player.name, 32),
          style: 'secondary'
        }))
      );
    }

    return {
      color: COLORS.vote,
      title: `round ${this.round}/${this.rounds} · find the impostor`,
      description: `**the clues**\n${board}\n\none of these players had a different word. vote for them.`,
      fields: [
        { name: 'votes in', value: `${bar(this.votes.size, active.length)} ${this.votes.size}/${active.length}`, inline: false }
      ],
      footer: `closes in ${mmss(this.phaseEndsAt - this.clock())} · you cannot vote for yourself`,
      rows
    };
  }

  revealView() {
    const reveal = this.reveal;
    const board = reveal.clues
      .map((row) => `**${row.name}** · ${truncate(row.clue, 40)}${row.id === reveal.impostorId ? ' · *the impostor*' : ''}`)
      .join('\n');

    const counts = this.players
      .map((player) => ({ ...player, score: reveal.counts.get(player.id) ?? 0 }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((player) => `${player.id === reveal.impostorId ? '◆' : '◇'} **${player.name}** · ${player.score}`)
      .join('\n');

    return {
      color: COLORS.reveal,
      title: reveal.caught ? 'caught' : 'the impostor got away',
      description:
        `**the word was ${this.pair.civilian}.** the impostor had **${this.pair.impostor}**.\n\n` +
        `**${reveal.impostorName}** was the impostor. ${reveal.caught ? `the room caught them with ${reveal.impostorVotes} vote${reveal.impostorVotes === 1 ? '' : 's'}.` : `the room picked someone else, ${plural(reveal.bestOther, 'vote')} to ${reveal.impostorVotes}.`}`,
      fields: [
        { name: 'the clues', value: truncate(board, 900), inline: false },
        { name: 'votes', value: counts, inline: true },
        { name: 'scores', value: scoreLines(this.standings(), { limit: 5 }), inline: true }
      ],
      footer: `next round in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: []
    };
  }

  finalLine() {
    const top = this.standings()[0];
    if (!top || top.score <= 0) return 'nobody caught anybody. worrying.';
    return `**${top.name}** read the room best, with ${top.score} points.`;
  }

  awards() {
    const caught = this.players.filter((player) => player.flags.has('caught'));
    const slipped = this.players.filter((player) => player.flags.has('slipped'));
    const lines = [];
    if (slipped.length) lines.push(`got away with it · ${slipped.map((player) => `**${player.name}**`).join(', ')}`);
    if (caught.length) lines.push(`sharp eyes · ${caught.map((player) => `**${player.name}**`).join(', ')}`);
    return lines.join('\n');
  }
}
