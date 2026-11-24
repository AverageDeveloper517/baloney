import test from 'node:test';
import assert from 'node:assert/strict';

import { MostLikelyGame, ML_TIMING } from '../src/games/mostlikely.js';
import { SITUATIONS } from '../src/content/situations.js';

const CLOCK = 2_000_000;

function table({ players = 3, rounds = 1 } = {}) {
  const game = new MostLikelyGame({
    channelId: 'c1',
    hostId: 'u1',
    situations: SITUATIONS,
    rounds,
    rng: () => 0.61,
    clock: () => CLOCK
  });

  for (let i = 1; i <= players; i += 1) {
    game.add({ id: `u${i}`, name: `player ${i}` });
  }

  return game;
}

function started(options) {
  const game = table(options);
  assert.equal(game.start().ok, true);
  return game;
}

test('most likely to needs three players and starts voting immediately', () => {
  const game = table({ players: 2 });
  assert.equal(game.start().reason, 'few');

  game.add({ id: 'u3', name: 'third' });
  assert.equal(game.start().ok, true);
  assert.equal(game.phase, 'vote');
  assert.ok(game.phaseEndsAt > CLOCK);
});

test('votes are private, single, and never for yourself', () => {
  const game = started();

  assert.equal(game.vote('u1', 'u1').reason, 'self');
  assert.equal(game.vote('u1', 'nobody').reason, 'target');
  assert.equal(game.vote('u1', 'u2').ok, true);
  assert.equal(game.vote('u1', 'u3').reason, 'voted');
});

test('the majority takes the point and a tie splits it', () => {
  const game = started();
  game.vote('u1', 'u2');
  game.vote('u2', 'u3');
  game.vote('u3', 'u2');

  assert.equal(game.allVoted(), true);
  assert.equal(game.advanceIfReady(), true);
  assert.equal(game.phase, 'reveal');
  assert.equal(game.get('u2').score, 1);
  assert.equal(game.get('u1').score, 0);
  assert.match(game.view().description, /player 2/);
});

test('a three-way tie gives everyone the point', () => {
  const game = started();
  game.vote('u1', 'u2');
  game.vote('u2', 'u3');
  game.vote('u3', 'u1');
  game.closeVotes();

  assert.equal(game.get('u1').score, 1);
  assert.equal(game.get('u2').score, 1);
  assert.equal(game.get('u3').score, 1);
  assert.equal(game.reveal.winners.length, 3);
});

test('a silent round resolves without a winner', () => {
  const game = started();
  game.closeVotes();

  assert.equal(game.phase, 'reveal');
  assert.equal(game.reveal.high, 0);
  assert.deepEqual(game.reveal.winners, []);
  assert.match(game.view().description, /nobody voted/);
});

test('rounds advance, then the final card ranks the room', () => {
  const game = started({ rounds: 2 });

  game.vote('u1', 'u2');
  game.vote('u2', 'u3');
  game.vote('u3', 'u2');
  game.closeVotes();

  assert.equal(game.nextRound(), true);
  assert.equal(game.round, 2);

  game.vote('u1', 'u3');
  game.vote('u2', 'u3');
  game.vote('u3', 'u2');
  game.closeVotes();

  assert.equal(game.nextRound(), true);
  assert.equal(game.phase, 'done');

  const view = game.view();
  assert.equal(view.title, 'the standings');
  assert.match(view.description, /player 2/);
});

test('the lobby times out cleanly', () => {
  const game = table({ players: 3 });
  game.tick(CLOCK + ML_TIMING.lobby);

  assert.equal(game.phase, 'dead');
  assert.match(game.view().title, /nobody started/);
  assert.deepEqual(game.view().rows, []);
});
