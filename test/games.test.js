import test from 'node:test';
import assert from 'node:assert/strict';

import { table, assertPayload, CLOCK } from '../test-support/helpers.js';
import { TRIVIA_TIMING } from '../src/games/trivia.js';
import { WYR_TIMING } from '../src/games/wyr.js';
import { NUMBER_TIMING } from '../src/games/number.js';
import { DUEL_TIMING } from '../src/games/duel.js';
import { CHAIN_TIMING } from '../src/games/chain.js';
import { IMPOSTOR_TIMING } from '../src/games/impostor.js';
import { SCATTER_TIMING } from '../src/games/scatter.js';

const letterAnswers = (letter) => [`${letter}ap`, `${letter}it`, `${letter}op`];

test('trivia scores correct answers, adds the speed bonus and ignores late votes', () => {
  let now = CLOCK;
  const game = table('trivia', { players: 4, rounds: 1, clock: () => now });
  const correct = game.correctIndex;
  const wrong = (correct + 1) % 4;

  assert.equal(game.options.length, 4);
  assert.equal(game.vote('u1', String(correct)).ok, true);
  assert.equal(game.vote('u1', String(correct)).reason, 'voted');
  assert.equal(game.vote('u2', '9').reason, 'missing');
  assert.equal(game.vote('u2', String(correct)).ok, true);
  assert.equal(game.vote('u3', String(wrong)).ok, true);
  assert.equal(game.vote('u4', String(correct)).ok, true);

  game.advanceIfReady(now);
  assert.equal(game.phase, 'reveal');
  assert.equal(game.get('u1').score, 150, 'correct plus the five-second bonus');
  assert.equal(game.get('u2').score, 150);
  assert.equal(game.get('u3').score, 0);
  assert.equal(game.reveal.right.length, 3);
  assert.equal(game.get('u1').counters.correct, 1);

  const payload = assertPayload(game.view());
  assert.match(payload.embeds[0].data.description, /got it/);

  assert.equal(game.vote('u4', String(correct)).reason, 'phase');
  now += TRIVIA_TIMING.reveal;
  game.tick(now);
  assert.equal(game.phase, 'done');
  assert.match(game.view().title, /standings/);
});

test('a slow trivia answer is worth 100, not 150', () => {
  let now = CLOCK;
  const game = table('trivia', { players: 2, rounds: 1, clock: () => now });
  now += 6_000;

  game.vote('u1', String(game.correctIndex));
  game.vote('u2', String((game.correctIndex + 1) % 4));
  game.advanceIfReady(now);

  assert.equal(game.get('u1').score, 100);
});

test('trivia ends a round early only when everyone has answered', () => {
  const game = table('trivia', { players: 3, rounds: 2 });

  game.vote('u1', '0');
  game.vote('u2', '1');
  assert.equal(game.advanceIfReady(CLOCK), false, 'one player is still thinking');
  assert.equal(game.phase, 'play');

  game.vote('u3', '2');
  assert.equal(game.advanceIfReady(CLOCK), true);
  assert.equal(game.phase, 'reveal');
});

test('would you rather pays the majority and marks a tiny minority', () => {
  const game = table('wyr', { players: 4, rounds: 1 });

  assert.equal(game.vote('u1', 'a').ok, true);
  assert.equal(game.vote('u1', 'b').reason, 'voted');
  assert.equal(game.vote('u2', 'x').reason, 'missing');
  game.vote('u2', 'a');
  game.vote('u3', 'a');
  game.vote('u4', 'b');

  game.advanceIfReady(CLOCK);
  assert.equal(game.phase, 'reveal');
  assert.equal(game.get('u1').score, 2);
  assert.equal(game.get('u2').score, 2);
  assert.equal(game.get('u3').score, 2);
  assert.equal(game.get('u4').score, 0);
  assert.ok(game.get('u4').flags.has('contrarian'));
  assert.equal(game.reveal.majority, 'a');
  assert.equal(game.reveal.a, 3);
  assert.equal(game.reveal.b, 1);

  assertPayload(game.view());
});

test('a would you rather tie pays everybody who voted', () => {
  const game = table('wyr', { players: 2, rounds: 1 });
  game.vote('u1', 'a');
  game.vote('u2', 'b');
  game.advanceIfReady(CLOCK);

  assert.equal(game.reveal.tie, true);
  assert.equal(game.get('u1').score, 1);
  assert.equal(game.get('u2').score, 1);
});

test('the number game validates input and scores exact, closest and second', () => {
  const game = table('number', { players: 3, rounds: 1 });
  const secret = game.secret;

  assert.equal(game.submit('u1', { number: 'abc' }).reason, 'range');
  assert.equal(game.submit('u1', { number: '0' }).reason, 'range');
  assert.equal(game.submit('u1', { number: '101' }).reason, 'range');

  assert.equal(game.submit('u1', { number: String(secret) }).ok, true);
  assert.equal(game.submit('u1', { number: '1' }).reason, 'already');
  game.submit('u2', { number: String(Math.max(1, secret - 3)) });
  game.submit('u3', { number: String(Math.min(100, secret + 20)) });

  game.advanceIfReady(CLOCK);
  assert.equal(game.phase, 'reveal');
  assert.equal(game.get('u1').score, 5);
  assert.ok(game.get('u1').flags.has('bullseye'));
  assert.equal(game.get('u2').score, 3);
  assert.equal(game.get('u3').score, 1);

  assertPayload(game.view());
});

test('the number game never repeats the previous secret', () => {
  let now = CLOCK;
  const game = table('number', { players: 3, rounds: 2, clock: () => now, rng: () => 0.42 });
  const first = game.secret;

  for (const id of ['u1', 'u2', 'u3']) game.submit(id, { number: '1' });
  game.advanceIfReady(now);
  now = game.phaseEndsAt;
  game.tick(now);

  assert.equal(game.phase, 'play');
  assert.equal(game.round, 2);
  assert.notEqual(game.secret, first);
});

test('duel needs exactly two players and ends as soon as someone takes two rounds', () => {
  const game = table('duel', { players: 2, clock: () => CLOCK });
  assert.equal(game.maxPlayers, 2);
  assert.equal(game.add({ id: 'u3', name: 'third' }).reason, 'started');

  assert.equal(game.vote('u1', 'banana').reason, 'missing');
  assert.equal(game.vote('u1', 'rock').ok, true);
  assert.equal(game.vote('u1', 'paper').reason, 'voted');
  game.vote('u2', 'paper');

  game.advanceIfReady(CLOCK);
  assert.equal(game.phase, 'reveal');
  assert.equal(game.get('u2').score, 1);

  game.tick(CLOCK);
  game.vote('u1', 'paper');
  game.vote('u2', 'scissors');
  game.advanceIfReady(CLOCK);
  game.tick(CLOCK);

  assert.equal(game.phase, 'done');
  assert.equal(game.round, 2, 'the match stopped at two rounds, not three');
  assert.equal(game.get('u2').score, 7, 'two rounds plus the match bonus');
  assert.ok(game.get('u2').flags.has('duelist'));
  assert.equal(game.matchWinner, 'u2');
  assert.match(game.finalLine(), /player 2/);
  assertPayload(game.view());
});

test('a drawn duel round awards nothing', () => {
  const game = table('duel', { players: 2 });
  game.vote('u1', 'rock');
  game.vote('u2', 'rock');
  game.advanceIfReady(CLOCK);

  assert.equal(game.reveal.winner, null);
  assert.equal(game.get('u1').score, 0);
  assert.equal(game.get('u2').score, 0);
});

test('chain story pays every vote and refuses self-votes', () => {
  const game = table('chain', { players: 3, rounds: 1 });
  game.submit('u1', { line: 'first line' });
  game.submit('u2', { line: 'second line' });
  game.submit('u3', { line: 'third line' });
  game.advanceIfReady(CLOCK);
  assert.equal(game.phase, 'vote');

  const lineOf = (id) => game.options.find((option) => option.authorId === id).key;
  assert.equal(game.vote('u1', lineOf('u1')).reason, 'own');
  const votes = { u1: 'u2', u2: 'u3', u3: 'u1' };
  for (const [voter, author] of Object.entries(votes)) {
    assert.equal(game.vote(voter, lineOf(author)).ok, true);
  }

  assert.equal(game.advanceIfReady(CLOCK), true);
  assert.equal(game.phase, 'reveal');
  for (const id of ['u1', 'u2', 'u3']) {
    assert.equal(game.get(id).score, 2);
    assert.ok(game.get(id).flags.has('crowd-pleaser'));
  }
  assert.equal(game.story.length, 1);
  assertPayload(game.view());
});

test('a chain round with one line skips the vote instead of showing one button', () => {
  const game = table('chain', { players: 3, rounds: 1 });
  game.submit('u1', { line: 'the only line' });
  game.closeSubmissions(CLOCK);

  assert.equal(game.phase, 'reveal');
  assert.equal(game.reveal.thin, true);
  assert.match(game.view().description, /room picked|stalls|enough lines/);
});

test('impostor deals one different word and protects it behind a private button', () => {
  const game = table('impostor', { players: 4, rounds: 1 });
  assert.equal(game.phase, 'brief');

  const words = new Set(['u1', 'u2', 'u3', 'u4'].map((id) => game.secret(id)));
  assert.equal(words.size, 2, 'three civilians and one impostor');
  assert.equal(game.secret('nobody'), null);

  for (const id of ['u1', 'u2', 'u3', 'u4']) game.markSeen(id);
  game.advanceIfReady(CLOCK);
  assert.equal(game.phase, 'clue');

  const impostor = game.impostorId;
  assert.equal(game.submit(impostor, { clue: game.secret(impostor) }).reason, 'word');
  for (const id of ['u1', 'u2', 'u3', 'u4']) game.submit(id, { clue: `clue ${id}` });
  game.advanceIfReady(CLOCK);
  assert.equal(game.phase, 'vote');

  assert.equal(game.vote(impostor, impostor).reason, 'self');
  const fallback = ['u1', 'u2', 'u3', 'u4'].find((id) => id !== impostor);
  for (const id of ['u1', 'u2', 'u3', 'u4']) game.vote(id, id === impostor ? fallback : impostor);
  game.advanceIfReady(CLOCK);

  assert.equal(game.reveal.caught, true);
  for (const id of ['u1', 'u2', 'u3', 'u4']) {
    assert.equal(game.get(id).score, id === impostor ? 0 : 2);
  }
  assert.ok(game.get(fallback).flags.has('caught'));
  assertPayload(game.view());
});

test('an impostor who survives takes four points and nobody else scores', () => {
  const game = table('impostor', { players: 4, rounds: 1 });
  for (const id of ['u1', 'u2', 'u3', 'u4']) game.markSeen(id);
  game.advanceIfReady(CLOCK);
  for (const id of ['u1', 'u2', 'u3', 'u4']) game.submit(id, { clue: `clue ${id}` });
  game.advanceIfReady(CLOCK);

  const impostor = game.impostorId;
  const scapegoat = ['u1', 'u2', 'u3', 'u4'].find((id) => id !== impostor);
  for (const id of ['u1', 'u2', 'u3', 'u4']) game.vote(id, scapegoat === id ? impostor : scapegoat);
  game.advanceIfReady(CLOCK);

  assert.equal(game.reveal.caught, false);
  assert.equal(game.get(impostor).score, 4);
  assert.ok(game.get(impostor).flags.has('slipped'));
  assert.equal(game.reveal.impostorVotes, 1);
  assert.match(game.view().title, /got away/);
});

test('scatter pays unique answers double, shared answers once and rejects the wrong letter', () => {
  const game = table('scatter', { players: 3, rounds: 1 });
  const letter = game.letter;
  const [a, b, c] = letterAnswers(letter);
  const invalid = letter === 'z' ? 'apple' : 'zzzz';

  game.submit('u1', { c0: a, c1: b, c2: c });
  game.submit('u2', { c0: a, c1: `${letter}un`, c2: `${letter}ed` });
  game.submit('u3', { c0: invalid, c1: invalid, c2: invalid });
  assert.equal(game.submit('u1', { c0: a, c1: b, c2: c }).reason, 'already');

  game.advanceIfReady(CLOCK);
  assert.equal(game.phase, 'reveal');

  assert.equal(game.get('u1').score, 5, 'one shared answer plus two unique ones');
  assert.equal(game.get('u2').score, 5);
  assert.equal(game.get('u3').score, 0);
  assert.ok(game.get('u1').flags.has('unique-sweep') === false);
  assertPayload(game.view());
});

test('a clean scatter sweep pays a bonus and requires three legal, unique answers', () => {
  const game = table('scatter', { players: 2, rounds: 1 });
  const letter = game.letter;
  const [a, b, c] = letterAnswers(letter);

  game.submit('u1', { c0: a, c1: b, c2: c });
  game.submit('u2', { c0: 'zzzz', c1: 'zzzz', c2: 'zzzz' });
  game.advanceIfReady(CLOCK);

  assert.equal(game.get('u1').score, 9, 'three unique answers plus the sweep');
  assert.ok(game.get('u1').flags.has('unique-sweep'));
  assert.equal(game.get('u2').score, 0, 'wrong letter answers score nothing');
  assert.match(game.view().title, /sheets/);
});

test('scatter refuses an entirely empty sheet and clamps the modal to three fields', () => {
  const game = table('scatter', { players: 2, rounds: 1 });
  assert.equal(game.submit('u1', { c0: '', c1: '', c2: '' }).reason, 'short');

  const form = game.writeForm();
  assert.equal(form.inputs.length, 3);
  assert.match(form.customId, /^gm:/);
});

test('every new game exposes a write form with a gm: modal id', () => {
  for (const [kind, phase] of [
    ['bluff', 'submit'],
    ['number', 'play'],
    ['chain', 'submit'],
    ['impostor', 'clue'],
    ['scatter', 'play']
  ]) {
    const game = table(kind, { players: 3 });
    if (kind === 'impostor') {
      for (const id of ['u1', 'u2', 'u3']) game.markSeen(id);
      game.advanceIfReady(CLOCK);
    }
    assert.equal(game.phase, phase);
    const form = game.writeForm();
    assert.ok(form, `${kind} has a form in ${phase}`);
    assert.match(form.customId, /^gm:/);
    assert.ok(form.inputs.length >= 1 && form.inputs.length <= 5);
  }
});

test('phase timers all respect the server pace multiplier', () => {
  const relaxed = table('trivia', { players: 3, rounds: 1, pace: 1.5, clock: () => CLOCK });
  assert.ok(relaxed.phaseEndsAt - CLOCK >= TRIVIA_TIMING.play, 'play window is stretched');

  const fast = table('trivia', { players: 3, rounds: 1, pace: 0.5, clock: () => CLOCK });
  assert.ok(fast.phaseEndsAt - CLOCK <= TRIVIA_TIMING.play, 'play window is shortened');
});

test('lobby timeouts close every new game cleanly', () => {
  for (const kind of ['trivia', 'wyr', 'number', 'duel', 'chain', 'impostor', 'scatter']) {
    const game = table(kind, { players: 3, start: false });
    const timing = { trivia: TRIVIA_TIMING, wyr: WYR_TIMING, number: NUMBER_TIMING, duel: DUEL_TIMING, chain: CHAIN_TIMING, impostor: IMPOSTOR_TIMING, scatter: SCATTER_TIMING }[kind];
    game.tick(CLOCK + timing.lobby);
    assert.equal(game.phase, 'dead', `${kind} lobby expires`);
    assert.match(game.view().title, /nobody started/);
    assertPayload(game.view());
  }
});
