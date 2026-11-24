import test from 'node:test';
import assert from 'node:assert/strict';

import { PROMPTS, PROMPT_COUNT, PACKS, PACK_NAMES, promptsForPack } from '../src/content/prompts.js';
import { SITUATIONS, SITUATION_COUNT } from '../src/content/situations.js';
import { TRIVIA, TRIVIA_COUNT } from '../src/content/trivia.js';
import { WYR, WYR_COUNT } from '../src/content/wyr.js';
import { IMPOSTOR, IMPOSTOR_COUNT } from '../src/content/impostor.js';
import { SCATTER_CATEGORIES, SCATTER_LETTERS, SCATTER_CATEGORY_COUNT, SCATTER_LETTER_COUNT } from '../src/content/scatter.js';
import { CHAIN_OPENERS, CHAIN_OPENER_COUNT } from '../src/content/chain.js';

const normalize = (value) => value.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

test('every bluff prompt is complete and unique', () => {
  const ids = new Set();
  const texts = new Set();

  for (const prompt of PROMPTS) {
    assert.match(prompt.id, /^p\d{2,}$/, `${prompt.id} is not a stable id`);
    assert.equal(ids.has(prompt.id), false, `duplicate id ${prompt.id}`);
    ids.add(prompt.id);

    assert.equal(texts.has(prompt.prompt), false, `duplicate prompt: ${prompt.prompt}`);
    texts.add(prompt.prompt);

    assert.match(prompt.prompt, /_{2,}/, `${prompt.id} has no blank`);
    assert.ok(prompt.answer.trim().length > 0, `${prompt.id} has no answer`);
    assert.ok(prompt.answer.length <= 48, `${prompt.id} answer is too long for a button-sized card`);
    assert.ok(prompt.fact.trim().length > 0, `${prompt.id} has no fact`);
    assert.ok(prompt.fact.length <= 300, `${prompt.id} fact is too long for the reveal card`);

    const words = new Set(normalize(prompt.prompt).split(' '));
    for (const word of normalize(prompt.answer).split(' ')) {
      assert.equal(words.has(word), false, `${prompt.id} gives away "${word}"`);
    }
  }

  assert.equal(PROMPT_COUNT, PROMPTS.length);
  assert.ok(PROMPTS.length >= 50, 'the bank should not repeat within a night');
});

test('bluff packs are disjoint and cover every prompt exactly once', () => {
  const seen = new Map();
  let total = 0;

  for (const pack of PACK_NAMES) {
    assert.ok(PACKS[pack].length > 0, `${pack} is empty`);
    for (const id of PACKS[pack]) {
      assert.equal(seen.has(id), false, `${id} appears in ${seen.get(id)} and ${pack}`);
      seen.set(id, pack);
      total += 1;
    }
    assert.equal(promptsForPack(pack).length, PACKS[pack].length);
    for (const prompt of promptsForPack(pack)) assert.equal(seen.get(prompt.id), pack);
  }

  assert.equal(total, PROMPTS.length, 'every prompt belongs to one pack');
  assert.equal(promptsForPack('all'), PROMPTS);
  assert.equal(promptsForPack('nonsense'), PROMPTS, 'an unknown pack falls back to everything');
});

test('every situation is unique and reads as a sentence ending', () => {
  const seen = new Set();

  for (const situation of SITUATIONS) {
    assert.equal(seen.has(situation), false, `duplicate situation: ${situation}`);
    seen.add(situation);
    assert.ok(situation.length >= 10 && situation.length <= 90, `odd length: ${situation}`);
    assert.equal(situation.endsWith('.'), false, 'the UI adds the punctuation');
    assert.equal(/^most likely to/i.test(situation), false, 'the UI adds the prefix');
  }

  assert.equal(SITUATION_COUNT, SITUATIONS.length);
  assert.ok(SITUATIONS.length >= 30);
});

test('trivia is complete, balanced and safe to render', () => {
  const categories = new Set(['science', 'history', 'geography', 'tech', 'movies', 'music', 'food', 'animals', 'sports', 'words', 'emoji']);
  const ids = new Set();
  const questions = new Set();
  const counts = [0, 0, 0, 0];

  for (const entry of TRIVIA) {
    assert.match(entry.id, /^t\d{2,}$/);
    assert.equal(ids.has(entry.id), false, `duplicate id ${entry.id}`);
    ids.add(entry.id);

    assert.ok(categories.has(entry.category), `bad category ${entry.category}`);
    assert.equal(questions.has(entry.q), false, `duplicate question: ${entry.q}`);
    questions.add(entry.q);

    assert.ok(entry.q.length >= 5 && entry.q.length <= 110, `${entry.id} question length`);

    if (entry.category === 'emoji') {
      assert.equal(/[\p{L}\p{N}]/u.test(entry.q), false, `${entry.id} emoji clue has letters or digits`);
    }

    assert.equal(entry.options.length, 4, `${entry.id} needs four options`);
    assert.equal(new Set(entry.options.map((option) => option.toLowerCase())).size, 4, `${entry.id} repeats an option`);
    for (const option of entry.options) assert.ok(option.length >= 1 && option.length <= 38, `${entry.id} option length`);

    assert.ok(Number.isInteger(entry.answer) && entry.answer >= 0 && entry.answer < 4, `${entry.id} answer index`);
    counts[entry.answer] += 1;

    assert.ok(entry.fact.length >= 20 && entry.fact.length <= 190, `${entry.id} fact length`);
  }

  assert.equal(TRIVIA_COUNT, TRIVIA.length);
  assert.ok(TRIVIA.length >= 60);
  assert.ok(TRIVIA.filter((entry) => entry.category === 'emoji').length >= 6, 'emoji round exists');
  for (const count of counts) assert.ok(count >= 10, 'answer positions are shuffled');
});

test('would you rather has unique halves and no duplicate pair', () => {
  const pairs = new Set();
  const sides = new Set();

  for (const entry of WYR) {
    assert.match(entry.id, /^w\d{2,}$/);
    assert.ok(entry.a.length >= 4 && entry.a.length <= 58, `${entry.id} side a length`);
    assert.ok(entry.b.length >= 4 && entry.b.length <= 58, `${entry.id} side b length`);
    assert.notEqual(entry.a, entry.b);
    assert.equal(entry.a.endsWith('.'), false);
    assert.equal(entry.b.endsWith('.'), false);

    const key = [entry.a, entry.b].sort().join('|');
    assert.equal(pairs.has(key), false, `duplicate pair ${entry.id}`);
    pairs.add(key);
    assert.equal(sides.has(entry.a), false, `duplicate side a: ${entry.a}`);
    assert.equal(sides.has(entry.b), false, `duplicate side b: ${entry.b}`);
    sides.add(entry.a);
    sides.add(entry.b);
  }

  assert.equal(WYR_COUNT, WYR.length);
  assert.ok(WYR.length >= 50);
});

test('impostor pairs are related, unique and family friendly', () => {
  const words = new Set();
  const pairs = new Set();

  for (const entry of IMPOSTOR) {
    assert.match(entry.id, /^i\d{2,}$/);
    assert.notEqual(entry.civilian, entry.impostor);
    assert.match(entry.civilian, /^[a-z]+( [a-z]+)?$/, `${entry.id} civilian word shape`);
    assert.match(entry.impostor, /^[a-z]+( [a-z]+)?$/, `${entry.id} impostor word shape`);
    assert.ok(entry.civilian.length >= 3 && entry.civilian.length <= 24);
    assert.ok(entry.impostor.length >= 3 && entry.impostor.length <= 24);
    assert.ok(entry.hint.length >= 3 && entry.hint.length <= 20);
    assert.equal(entry.hint, entry.hint.toLowerCase());

    const pair = [entry.civilian, entry.impostor].sort().join('|');
    assert.equal(pairs.has(pair), false, `duplicate pair ${entry.id}`);
    pairs.add(pair);

    for (const word of [entry.civilian, entry.impostor]) {
      assert.equal(words.has(word), false, `duplicate word: ${word}`);
      words.add(word);
    }
  }

  assert.equal(IMPOSTOR_COUNT, IMPOSTOR.length);
  assert.ok(IMPOSTOR.length >= 40);
});

test('scatter categories and letters are the exact tested set', () => {
  assert.equal(SCATTER_LETTERS.join(''), 'abcdefghlmprstw');
  assert.equal(SCATTER_LETTER_COUNT, 15);
  assert.equal(SCATTER_CATEGORY_COUNT, SCATTER_CATEGORIES.length);
  assert.ok(SCATTER_CATEGORIES.length >= 36);

  const seen = new Set();
  for (const category of SCATTER_CATEGORIES) {
    assert.equal(seen.has(category), false, `duplicate category: ${category}`);
    seen.add(category);
    assert.ok(category.length >= 6 && category.length <= 30, `category length: ${category}`);
  }
});

test('chain openers are complete, unique sentences', () => {
  const seen = new Set();
  for (const opener of CHAIN_OPENERS) {
    assert.equal(seen.has(opener), false, `duplicate opener: ${opener}`);
    seen.add(opener);
    assert.ok(opener.length >= 20 && opener.length <= 110, `opener length: ${opener}`);
    assert.equal(opener.endsWith('.'), true, 'openers are complete sentences');
  }

  assert.equal(CHAIN_OPENER_COUNT, CHAIN_OPENERS.length);
  assert.ok(CHAIN_OPENERS.length >= 30);
});
