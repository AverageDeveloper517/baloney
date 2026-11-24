import { Lobby, COLORS, mmss, plural, scoreLines, truncate } from './games/base.js';

export const PARTY_PLAYLISTS = {
  quick: { label: 'quick', games: ['trivia', 'wyr', 'number'] },
  classic: { label: 'classic', games: ['bluff', 'trivia', 'mostlikely'] },
  chaos: { label: 'chaos', games: ['scatter', 'impostor', 'chain'] },
  marathon: { label: 'marathon', games: ['bluff', 'trivia', 'wyr', 'impostor', 'scatter', 'mostlikely'] }
};

export const PARTY_POINTS = [5, 3, 2, 1];
export const PARTY_BREAK_MS = 8_000;

/** The lobby for a whole night: one join list, a playlist, then games back to back. */
export class PartyLobby extends Lobby {
  constructor({ playlist = [], labels = [], rounds = 3, ...rest }) {
    super({ ...rest, minPlayers: 3, maxPlayers: 10, lobbyMs: 4 * 60_000 });
    this.kind = 'party';
    this.playlist = playlist;
    this.labels = labels;
    this.rounds = rounds;
    this.played = [];
  }

  start() {
    if (this.phase !== 'lobby') return { ok: false, reason: 'phase' };
    if (this.size < this.minPlayers) return { ok: false, reason: 'few' };
    this.phase = 'done';
    this.phaseEndsAt = null;
    return { ok: true };
  }

  view() {
    if (this.phase === 'dead') {
      return this.closedView('nobody started', 'the lobby timed out before three players joined.');
    }
    if (this.phase === 'done') {
      return this.closedView('the party is starting', 'swapping in the first game.');
    }

    const host = this.host?.name ?? 'nobody';
    const names = this.players.length
      ? this.players.map((player) => (player.id === this.hostId ? `**${player.name}** · host` : player.name)).join('\n')
      : 'nobody yet';
    const lineup = this.labels.map((label, index) => `${index + 1}. ${label}`).join('\n');

    return {
      color: COLORS.party,
      title: 'party night · lobby',
      description:
        '**one lobby, a whole night.** join once, then every game runs back to back in this channel.\\n\\n' +
        'points are awarded per game, and the party champion is whoever survives the playlist.',
      fields: [
        { name: `players · ${this.size}/${this.maxPlayers}`, value: names, inline: false },
        { name: 'the lineup', value: lineup, inline: false },
        {
          name: 'scoring',
          value: 'each game pays 5 / 3 / 2 / 1 party points by finishing position. ties share the points.',
          inline: false
        }
      ],
      footer: `host: ${host} · lobby closes in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: [
        [
          { id: `pt:${this.id}:join`, label: 'Join', style: 'success', disabled: this.full },
          { id: `pt:${this.id}:leave`, label: 'Leave', style: 'secondary' },
          { id: `pt:${this.id}:start`, label: 'Start the night', style: 'primary', disabled: this.size < this.minPlayers },
          { id: `pt:${this.id}:cancel`, label: 'Cancel', style: 'danger' }
        ]
      ]
    };
  }
}

/** The eight seconds between two games: standings so far and what is next. */
export class PartyBreak extends Lobby {
  constructor({ upNext, table, played, ...rest }) {
    super({ ...rest, minPlayers: 1, maxPlayers: 10, lobbyMs: PARTY_BREAK_MS });
    this.kind = 'party-break';
    this.upNext = upNext;
    this.table = table;
    this.played = played;
    this.phase = 'play';
    this.phaseEndsAt = this.clock() + PARTY_BREAK_MS;
  }

  tick() {
    this.phase = 'done';
    this.phaseEndsAt = null;
    return true;
  }

  view() {
    if (this.phase === 'done') return this.closedView('moving on', 'the next game is loading.');

    return {
      color: COLORS.party,
      title: 'up next',
      description: `**${this.upNext}** starts in a moment.\n\n${truncate(this.played, 300)}`,
      fields: [{ name: 'the party so far', value: this.table || 'no points yet', inline: false }],
      footer: `starting in ${mmss(this.phaseEndsAt - this.clock())}`,
      rows: []
    };
  }
}

/** The last card of a party: the champion, the table and the invite. */
export class PartyBoard extends Lobby {
  constructor({ table, champion, played, roster = [], ...rest }) {
    super({ ...rest, minPlayers: 1, maxPlayers: 10, lobbyMs: 1_000 });
    this.kind = 'party-board';
    this.phase = 'done';
    this.phaseEndsAt = null;
    this.table = table;
    this.champion = champion;
    this.played = played;
    this.roster = roster;
  }

  view() {
    return {
      color: COLORS.party,
      title: 'the party is over',
      description: `${this.champion}\n\n${this.played}`,
      fields: [{ name: 'party table', value: this.table || 'nobody scored', inline: false }],
      footer: 'one lobby, the whole night · /party starts another',
      rows: [],
      invite: true
    };
  }
}

/**
 * Runs the playlist. Each finished game pays party points, a short break shows
 * the standings, and the last card crowns the champion.
 */
export class PartyRun {
  constructor({ playlist, labels, rounds, channelId, guildId, hostId, clock, pace, makeGame }) {
    this.playlist = playlist;
    this.labels = labels;
    this.rounds = rounds;
    this.channelId = channelId;
    this.guildId = guildId;
    this.hostId = hostId;
    this.clock = clock;
    this.pace = pace;
    this.makeGame = makeGame;

    this.index = -1;
    this.roster = [];
    this.scores = new Map();
    this.played = [];
    this.finished = 0;
  }

  lobby() {
    return new PartyLobby({
      playlist: this.playlist,
      labels: this.labels,
      rounds: this.rounds,
      channelId: this.channelId,
      guildId: this.guildId,
      hostId: this.hostId,
      clock: this.clock,
      pace: this.pace
    });
  }

  /** 5 / 3 / 2 / 1 points by finishing position; equal scores share a rank. */
  tally(game) {
    const standings = game.standings();
    const seen = new Map();
    let rank = 0;

    for (const player of standings) {
      if (player.left) continue;
      if (!seen.has(player.score)) {
        rank += 1;
        seen.set(player.score, PARTY_POINTS[rank - 1] ?? 1);
      }
      const points = seen.get(player.score);
      const row = this.scores.get(player.id) ?? { id: player.id, name: player.name, score: 0 };
      row.score += points;
      row.name = player.name;
      this.scores.set(player.id, row);
    }

    this.roster = this.roster.filter((entry) => !game.get(entry.id)?.left);
    this.finished += 1;

    const top = game.standings().filter((player) => !player.left);
    const best = top.length ? top[0].score : 0;
    const winners = top.filter((player) => player.score === best && best > 0).map((player) => player.name);
    this.played.push({
      label: this.labelOf(game.kind),
      winners: winners.length ? winners : ['nobody'],
      line: game.finalLine ? game.finalLine() : ''
    });
  }

  labelOf(kind) {
    const index = this.playlist.indexOf(kind);
    return this.labels[index] ?? kind;
  }

  table() {
    const rows = [...this.scores.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return scoreLines(rows, { limit: 10, unit: ' pts' });
  }

  playedLine() {
    return this.played
      .map((entry) => `**${entry.label}** · ${truncate(entry.winners.join(', '), 80)}`)
      .join('\n');
  }

  startNext() {
    while (this.index + 1 < this.playlist.length) {
      this.index += 1;
      const kind = this.playlist[this.index];
      const game = this.makeGame(kind);
      for (const entry of this.roster) game.add({ id: entry.id, name: entry.name });

      const started = game.start();
      if (started.ok) return game;
    }
    return this.board();
  }

  board() {
    const rows = [...this.scores.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const top = rows[0]?.score ?? 0;
    const champions = rows.filter((row) => row.score === top && top > 0);

    const champion = champions.length
      ? champions.length === 1
        ? `**${champions[0].name}** wins the party with ${top} points.`
        : `${champions.map((row) => `**${row.name}**`).join(' and ')} share the party crown on ${top}.`
      : 'the party ended with no points on the board.';

    return new PartyBoard({
      table: this.table(),
      champion,
      played: `${plural(this.finished, 'game')} played · ${plural(this.roster.length, 'player')} survived`,
      roster: this.roster,
      channelId: this.channelId,
      guildId: this.guildId,
      hostId: this.roster[0]?.id ?? this.hostId,
      clock: this.clock,
      pace: this.pace
    });
  }

  /**
   * Session planner: given the game that just finished, return the next game in
   * the channel, or null when the session should close.
   */
  next(game, reason) {
    if (reason !== 'done') return null;

    if (game.kind === 'party') {
      this.roster = game.players.filter((player) => !player.left).map((player) => ({ id: player.id, name: player.name }));
      return this.startNext();
    }

    if (game.kind === 'party-break') return this.startNext();
    if (game.kind === 'party-board') return null;

    this.tally(game);
    if (this.index + 1 >= this.playlist.length) return this.board();

    const upNext = this.labels[this.index + 1] ?? this.playlist[this.index + 1];
    return new PartyBreak({
      upNext,
      table: this.table(),
      played: this.playedLine(),
      channelId: this.channelId,
      guildId: this.guildId,
      hostId: this.roster[0]?.id ?? this.hostId,
      clock: this.clock,
      pace: this.pace
    });
  }
}
