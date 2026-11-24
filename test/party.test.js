import test from 'node:test';
import assert from 'node:assert/strict';

import { PartyRun, PARTY_PLAYLISTS, PARTY_POINTS } from '../src/party.js';
import { createGame, GAME_DEFS } from '../src/games/index.js';
import { Session } from '../src/session.js';
import { CLOCK, assertPayload } from '../test-support/helpers.js';

function rig({ playlist = ['trivia', 'wyr'], rounds = 1 } = {}) {
  let now = CLOCK;
  const run = new PartyRun({
    playlist,
    labels: playlist.map((kind) => GAME_DEFS[kind].label),
    rounds,
    channelId: 'c1',
    guildId: 'g1',
    hostId: 'u1',
    clock: () => now,
    pace: 1,
    makeGame: (kind) =>
      createGame(kind, {
        channelId: 'c1',
        guildId: 'g1',
        hostId: 'u1',
        clock: () => now,
        rng: () => 0.42,
        rounds
      })
  });

  const lobby = run.lobby();
  for (const id of ['u1', 'u2', 'u3']) lobby.add({ id, name: id });

  return {
    run,
    lobby,
    now: () => now,
    setNow: (value) => {
      now = value;
    }
  };
}

function finishTrivia(game) {
  game.vote('u1', String(game.correctIndex));
  game.vote('u2', String((game.correctIndex + 1) % 4));
  game.vote('u3', String((game.correctIndex + 2) % 4));
  game.advanceIfReady(game.clock());
  game.tick(game.phaseEndsAt);
  assert.equal(game.phase, 'done');
}

function finishWyr(game) {
  game.vote('u1', 'a');
  game.vote('u2', 'a');
  game.vote('u3', 'b');
  game.advanceIfReady(game.clock());
  game.tick(game.phaseEndsAt);
  assert.equal(game.phase, 'done');
}

test('every playlist names real games and together they cover the whole catalogue', () => {
  const covered = new Set();

  for (const [key, entry] of Object.entries(PARTY_PLAYLISTS)) {
    assert.ok(entry.games.length >= 3, `${key} is too short to be a night`);
    for (const kind of entry.games) {
      assert.ok(GAME_DEFS[kind], `${key} includes unknown ${kind}`);
      covered.add(kind);
    }
    assert.equal(new Set(entry.games).size, entry.games.length, `${key} repeats a game`);
  }

  // Duel is a two-player game, so it can never sit in a three-player party.
  assert.deepEqual([...covered].sort(), Object.keys(GAME_DEFS).filter((kind) => kind !== 'duel').sort());
  assert.equal(PARTY_POINTS.length, 4);
});

test('party points are 5/3/2/1 and ties share a rank', () => {
  const { run, lobby, setNow } = rig();
  lobby.start();

  const first = run.next(lobby, 'done');
  assert.equal(first.kind, 'trivia');

  finishTrivia(first);
  setNow(first.phaseEndsAt);
  const breakCard = run.next(first, 'done');

  assert.equal(breakCard.kind, 'party-break');
  assert.equal(run.scores.get('u1').score, 5);
  assert.equal(run.scores.get('u2').score, 3, 'a tie for second shares the runner-up points');
  assert.equal(run.scores.get('u3').score, 3);
  assert.equal(run.finished, 1);
  assert.equal(run.played[0].winners[0], 'u1');
});

test('a party runs from lobby to game to break to game to champion board', () => {
  const { run, lobby, setNow } = rig();
  lobby.start();

  const first = run.next(lobby, 'done');
  assert.equal(first.kind, 'trivia');

  finishTrivia(first);
  setNow(first.phaseEndsAt);

  const breakCard = run.next(first, 'done');
  assert.equal(breakCard.kind, 'party-break');
  assert.match(breakCard.view().title, /up next/);

  const second = run.next(breakCard, 'done');
  assert.equal(second.kind, 'wyr');
  assert.equal(second.size, 3, 'the roster carries across games');

  finishWyr(second);
  setNow(second.phaseEndsAt);

  const board = run.next(second, 'done');
  assert.equal(board.kind, 'party-board');
  assert.equal(board.roster.length, 3);
  assert.match(board.view().description, /wins the party|share the party crown/);
  assertPayload(board.view(), { invite: 'https://example.test', expectInvite: true });
});

test('a party that loses every player still produces an honest board', () => {
  const { run, lobby } = rig();
  lobby.start();
  const first = run.next(lobby, 'done');

  for (const id of ['u1', 'u2', 'u3']) first.remove(id);
  run.tally(first);

  const board = run.board();
  assert.equal(board.roster.length, 0);
  assert.match(board.view().description, /no points on the board/);
  assertPayload(board.view());
});

test('the planner refuses to advance a cancelled game', () => {
  const { run, lobby } = rig();
  lobby.start();
  run.next(lobby, 'done');

  assert.equal(run.next(lobby, 'dead'), null);
});

test('a session chains party games on one message until the board closes it', async () => {
  const { run, lobby, setNow } = rig();
  lobby.start();

  const scheduled = [];
  const ticks = [];
  const closes = [];
  const edits = [];
  let current = lobby;

  const session = new Session({
    game: lobby,
    now: () => current.phaseEndsAt ?? CLOCK,
    timers: {
      set: (fn, ms) => {
        const handle = { fn, ms };
        scheduled.push(handle);
        return handle;
      },
      clear: () => {}
    },
    update: async (payload) => edits.push(payload),
    onEnd: async (game, reason) => ticks.push(`${game.kind}:${reason}`),
    onClose: async () => closes.push('closed'),
    planNext: async (game, reason) => {
      const next = run.next(game, reason);
      if (next) current = next;
      return next;
    },
    log: () => {}
  });

  await session.refresh();
  assert.equal(session.game.kind, 'trivia', 'the lobby hands straight to the first game');
  assert.ok(scheduled.length >= 1);

  let trivia = session.game;
  trivia.vote('u1', String(trivia.correctIndex));
  trivia.vote('u2', String((trivia.correctIndex + 1) % 4));
  trivia.vote('u3', String((trivia.correctIndex + 2) % 4));
  await session.refresh();
  assert.equal(session.game.phase, 'reveal');

  setNow(trivia.phaseEndsAt);
  await session.onTimer();
  assert.equal(session.game.kind, 'party-break');

  const breakCard = session.game;
  setNow(breakCard.phaseEndsAt);
  await session.onTimer();
  assert.equal(session.game.kind, 'wyr');

  const wyr = session.game;
  wyr.vote('u1', 'a');
  wyr.vote('u2', 'a');
  wyr.vote('u3', 'b');
  await session.refresh();
  setNow(wyr.phaseEndsAt);
  await session.onTimer();

  assert.equal(session.game.kind, 'party-board');
  assert.equal(session.ended, true);
  assert.deepEqual(closes, ['closed']);
  assert.deepEqual(ticks, ['party:done', 'trivia:done', 'party-break:done', 'wyr:done', 'party-board:done']);
  assert.ok(edits.length >= 6, 'one message was edited throughout');
});
