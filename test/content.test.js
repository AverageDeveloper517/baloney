import test from 'node:test';
import assert from 'node:assert/strict';

import { PROMPTS, PROMPT_COUNT } from '../src/content/prompts.js';
import { SITUATIONS, SITUATION_COUNT } from '../src/content/situations.js';

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

    // The answer must not already be sitting in the prompt as a word.
    const words = new Set(normalize(prompt.prompt).split(' '));
    for (const word of normalize(prompt.answer).split(' ')) {
      assert.equal(words.has(word), false, `${prompt.id} gives away "${word}"`);
    }
  }

  assert.equal(PROMPT_COUNT, PROMPTS.length);
  assert.ok(PROMPTS.length >= 50, 'the bank should not repeat within a night');
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
