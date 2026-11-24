import test from 'node:test';
import assert from 'node:assert/strict';

import { BluffGame, BLUFF_TIMING } from '../src/games/bluff.js';
import { PROMPTS } from '../src/content/prompts.js';

const CLOCK = 1_000_000;
const rng = () => 0.37;

function table({ players = 3, rounds = 1 } = {}) {
  const game = new BluffGame({
    channelId: 'c1',
    hostId: 'u1',
    prompts: PROMPTS,
    rounds,
    rng,
    clock: () => CLOCK
  });

  for (let i = 1; i <= players; i += 1) {
    game.add({ id: `u${i}`, name: `player ${i}` });
  }

  return game;
}

function started(options) {
  const game = table(options);
  const result = game.start();
  assert.equal(result.ok, true);
  return game;
}

const optionOf = (game, userId) =>
  game.options.find((option) => option.authors.includes(userId));

test('a lobby needs three players before it can start', () => {
  const game = table({ players: 2 });
  assert.equal(game.start().reason, 'few');

  game.add({ id: 'u3', name: 'third' });
  assert.equal(game.start().ok, true);
  assert.equal(game.phase, 'submit');
  assert.equal(game.round, 1);
  assert.ok(game.phaseEndsAt > CLOCK);
});

test('the lobby caps at ten and refuses duplicate joins', () => {
  const game = table({ players: 10 });
  assert.equal(game.add({ id: 'u11', name: 'late' }).reason, 'full');
  assert.equal(game.add({ id: 'u1', name: 'again' }).reason, 'already');
  assert.equal(game.size, 10);
});

test('leaving the lobby hands the host badge to the next player', () => {
  const game = table({ players: 3 });
  game.remove('u1');
  assert.equal(game.hostId, 'u2');
  assert.equal(game.size, 2);

  game.remove('u2');
  game.remove('u3');
  assert.equal(game.size, 0);
  assert.equal(game.hostId, null);
});

test('a whole round scores the truth, the lies and the people fooled', () => {
  const game = started();
  const answer = game.prompt.answer;

  assert.equal(game.submit('u1', 'a completely invented answer').ok, true);
  assert.equal(game.submit('u2', 'another invented answer').ok, true);
  assert.equal(game.submit('u3', answer).truth, true);

  assert.equal(game.allSubmitted(), true);
  assert.equal(game.advanceIfReady(), true);
  assert.equal(game.phase, 'vote');
  assert.equal(game.options.length, 3, 'two lies plus the truth');

  const truth = game.options.find((option) => option.truth);
  const lie = optionOf(game, 'u1');

  assert.equal(game.vote('u1', truth.key).ok, true);
  assert.equal(game.vote('u2', lie.key).ok, true);
  assert.equal(game.vote('u3', truth.key).reason, 'truth', 'the truth writer sits out');

  assert.equal(game.allVoted(), true);
  assert.equal(game.advanceIfReady(), true);
  assert.equal(game.phase, 'reveal');

  assert.equal(game.get('u1').score, 1_500, '1000 for the truth plus 500 for the fool');
  assert.equal(game.get('u1').found, 1);
  assert.equal(game.get('u1').fooled, 1);
  assert.equal(game.get('u1').best, 1);
  assert.equal(game.get('u2').score, 0);
  assert.equal(game.get('u3').score, 0);
  assert.equal(game.reveal.found, 1);
});

test('you cannot vote for your own lie, twice, or after the window', () => {
  const game = started();
  game.submit('u1', 'lie one');
  game.submit('u2', 'lie two');
  game.submit('u3', game.prompt.answer);
  game.closeSubmissions();

  const own = optionOf(game, 'u1');
  assert.equal(game.vote('u1', own.key).reason, 'own');

  const truth = game.options.find((option) => option.truth);
  assert.equal(game.vote('u1', truth.key).ok, true);
  assert.equal(game.vote('u1', truth.key).reason, 'voted');
  assert.equal(game.vote('u2', 'Z').reason, 'missing');

  game.closeVotes();
  assert.equal(game.vote('u2', truth.key).reason, 'phase');
});

test('identical lies merge and pay both authors', () => {
  const game = started({ players: 4 });
  game.submit('u1', 'a very good lie');
  const merged = game.submit('u2', 'A very good lie!');
  game.submit('u3', 'a different lie');
  game.submit('u4', game.prompt.answer);

  assert.equal(merged.merged, true);
  game.closeSubmissions();

  assert.equal(game.options.length, 3, 'one shared lie, one solo lie, one truth');
  const shared = game.options.find((option) => !option.truth && option.authors.length === 2);
  assert.deepEqual(shared.authors.sort(), ['u1', 'u2']);

  game.vote('u3', shared.key);
  game.closeVotes();

  assert.equal(game.get('u1').score, 500);
  assert.equal(game.get('u2').score, 500);
  assert.equal(game.get('u3').score, 0);
  assert.equal(game.get('u4').score, 0);
});

test('writing the real answer is allowed but costs you the vote', () => {
  const game = started();
  const result = game.submit('u1', game.prompt.answer.toUpperCase());

  assert.equal(result.truth, true);
  assert.equal(game.get('u1').truths, 1);
  assert.equal(game.eligibleVoters().length, 2);
});

test('a round with no lies reveals the answer instead of showing a one-button vote', () => {
  const game = started();
  for (const id of ['u1', 'u2', 'u3']) game.submit(id, game.prompt.answer);

  game.closeSubmissions();

  assert.equal(game.phase, 'reveal');
  assert.equal(game.reveal.empty, true);
  assert.equal(game.options.length, 1);
});

test('the submit screen never leaks an answer that is still secret', () => {
  const game = started();
  game.submit('u1', 'the secret pineapple');

  const screen = JSON.stringify(game.view());
  assert.equal(screen.includes('the secret pineapple'), false);
  assert.equal(screen.includes('answers in'), true);
  assert.equal(screen.includes('1/3'), true);
});

test('rounds advance and the final card crowns a winner', () => {
  const game = started({ rounds: 2 });
  const answer = game.prompt.answer;

  game.submit('u1', 'lie one');
  game.submit('u2', 'lie two');
  game.submit('u3', answer);
  game.closeSubmissions();
  game.vote('u1', game.options.find((option) => option.truth).key);
  game.closeVotes();

  assert.equal(game.nextRound(), true);
  assert.equal(game.round, 2);
  assert.equal(game.phase, 'submit');

  game.submit('u1', 'lie three');
  game.submit('u2', 'lie four');
  game.submit('u3', game.prompt.answer);
  game.closeSubmissions();
  game.closeVotes();

  assert.equal(game.nextRound(), true);
  assert.equal(game.phase, 'done');
  assert.equal(game.phaseEndsAt, null);

  const view = game.view();
  assert.equal(view.title, 'the standings');
  assert.match(view.description, /player 1/);
  assert.match(view.fields[1].value, /biggest liar|sharpest|nobody/);
});

test('a player who leaves mid-game is not asked for input', () => {
  const game = started();
  game.submit('u1', 'lie one');
  game.remove('u2');

  assert.equal(game.get('u2').left, true);
  assert.equal(game.allSubmitted(), false);

  game.submit('u3', 'lie two');
  assert.equal(game.allSubmitted(), true);

  game.closeSubmissions();
  game.vote('u1', game.options.find((option) => option.truth).key);
  game.vote('u3', optionOf(game, 'u1').key);
  assert.equal(game.allVoted(), true);
});

test('the lobby expires into a closed card', () => {
  const game = table({ players: 3 });
  assert.equal(game.tick(CLOCK + BLUFF_TIMING.lobby), true);
  assert.equal(game.phase, 'dead');
  assert.match(game.view().title, /nobody started/);
  assert.deepEqual(game.view().rows, []);
});
