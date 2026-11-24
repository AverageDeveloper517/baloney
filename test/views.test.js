import test from 'node:test';
import assert from 'node:assert/strict';

import { BluffGame } from '../src/games/bluff.js';
import { MostLikelyGame } from '../src/games/mostlikely.js';
import { PROMPTS } from '../src/content/prompts.js';
import { SITUATIONS } from '../src/content/situations.js';
import { toPayload } from '../src/ui.js';

const CLOCK = 5_000_000;
const INVITE = 'https://discord.com/oauth2/authorize?client_id=1&scope=bot';

function bluff(players = 3, rounds = 1) {
  const game = new BluffGame({
    channelId: 'c1',
    hostId: 'u1',
    prompts: PROMPTS,
    rounds,
    rng: () => 0.29,
    clock: () => CLOCK
  });
  for (let i = 1; i <= players; i += 1) game.add({ id: `u${i}`, name: `player ${i}` });
  return game;
}

function mostlikely(players = 3, rounds = 1) {
  const game = new MostLikelyGame({
    channelId: 'c1',
    hostId: 'u1',
    situations: SITUATIONS,
    rounds,
    rng: () => 0.53,
    clock: () => CLOCK
  });
  for (let i = 1; i <= players; i += 1) game.add({ id: `u${i}`, name: `player ${i}` });
  return game;
}

function assertPayload(view, { expectInvite = false } = {}) {
  const payload = toPayload(view, { invite: INVITE });
  const embed = payload.embeds[0].data;

  assert.ok((embed.title ?? '').length <= 256, 'title fits');
  assert.ok((embed.description ?? '').length <= 4_096, 'description fits');
  assert.ok((embed.footer?.text ?? '').length <= 2_048, 'footer fits');
  assert.ok((embed.fields ?? []).length <= 25, 'field count fits');

  for (const field of embed.fields ?? []) {
    assert.ok(field.name.length <= 256, `field name fits: ${field.name}`);
    assert.ok(field.value.length <= 1_024, `field value fits: ${field.name}`);
  }

  assert.ok(payload.components.length <= 5, 'row count fits');

  for (const row of payload.components) {
    assert.ok(row.components.length <= 5, 'button count per row fits');
    for (const button of row.components) {
      const data = button.data;
      assert.ok((data.label ?? '').length <= 80, 'label fits');
      if (data.custom_id) assert.ok(data.custom_id.length <= 100, 'custom id fits');
    }
  }

  if (expectInvite) {
    const last = payload.components.at(-1)?.components?.[0]?.data;
    assert.equal(last?.url, INVITE);
  }

  return payload;
}

test('every bluff screen fits inside a Discord message', () => {
  const game = bluff(4, 2);
  assertPayload(game.view());

  game.start();
  assertPayload(game.view());

  for (const id of ['u1', 'u2', 'u3', 'u4']) {
    game.submit(id, `lie number ${id}`);
  }
  game.closeSubmissions();
  assertPayload(game.view());

  game.vote('u1', game.options.find((option) => option.truth).key);
  game.closeVotes();
  assertPayload(game.view());

  game.nextRound();
  game.submit('u1', game.prompt.answer);
  game.submit('u2', 'lie');
  game.submit('u3', 'another lie');
  game.submit('u4', 'third lie');
  game.closeSubmissions();
  game.closeVotes();
  game.nextRound();

  assert.equal(game.phase, 'done');
  assertPayload(game.view(), { expectInvite: true });
});

test('a full table of maximum-length lies still fits', () => {
  const game = bluff(10, 1);
  game.start();

  const long = (n) => `lie ${n} `.padEnd(80, 'x').slice(0, 80);
  for (let i = 1; i <= 10; i += 1) game.submit(`u${i}`, long(i));

  game.closeSubmissions();
  assert.equal(game.options.length, 11);
  assertPayload(game.view());

  for (let i = 1; i <= 10; i += 1) {
    const key = game.options.find((option) => !option.authors.includes(`u${i}`))?.key;
    if (key) game.vote(`u${i}`, key);
  }
  game.closeVotes();
  assertPayload(game.view());
});

test('every most likely to screen fits, including a ten-player vote', () => {
  const game = mostlikely(10, 2);
  assertPayload(game.view());

  game.start();
  const vote = assertPayload(game.view());
  assert.ok(vote.components.length >= 2, 'ten names need two rows');

  for (let i = 1; i <= 10; i += 1) {
    game.vote(`u${i}`, `u${((i + 1) % 10) + 1}`);
  }
  game.closeVotes();
  assertPayload(game.view());

  game.nextRound();
  game.closeVotes();
  game.nextRound();

  assert.equal(game.phase, 'done');
  assertPayload(game.view(), { expectInvite: true });
});

test('the invite button only appears when a client id exists', () => {
  const game = bluff(3, 1);
  game.start();
  for (const id of ['u1', 'u2', 'u3']) game.submit(id, `lie ${id}`);
  game.closeSubmissions();
  game.closeVotes();
  game.nextRound();

  const without = toPayload(game.view());
  assert.equal(without.components.length, 0);

  const withInvite = toPayload(game.view(), { invite: INVITE });
  assert.equal(withInvite.components.at(-1).components[0].data.url, INVITE);
});

test('player-written text cannot inject a ping or a mention', () => {
  const game = bluff(3, 1);
  game.start();
  game.submit('u1', '@everyone look at this');
  game.submit('u2', '<@123456789012345678> hi');
  game.submit('u3', '```discord.gg/example```');
  game.closeSubmissions();

  const payload = assertPayload(game.view());
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assert.equal(JSON.stringify(payload.embeds[0].data).includes('<@123456789012345678>'), false);
});
