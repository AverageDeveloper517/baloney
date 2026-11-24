import test from 'node:test';
import assert from 'node:assert/strict';

import { BluffGame } from '../src/games/bluff.js';
import { Session } from '../src/session.js';
import { PROMPTS } from '../src/content/prompts.js';

function rig({ start = true } = {}) {
  let time = 100_000;
  const scheduled = [];
  const cleared = [];
  const updates = [];
  const endings = [];

  const game = new BluffGame({
    channelId: 'c1',
    hostId: 'u1',
    prompts: PROMPTS,
    rounds: 1,
    rng: () => 0.44,
    clock: () => time
  });
  for (const id of ['u1', 'u2', 'u3']) game.add({ id, name: id });
  if (start) game.start();

  const session = new Session({
    game,
    now: () => time,
    timers: {
      set: (fn, ms) => {
        const handle = { fn, ms };
        scheduled.push(handle);
        return handle;
      },
      clear: (handle) => cleared.push(handle)
    },
    update: async (payload) => updates.push(payload),
    onEnd: async (finished, reason) => endings.push(reason),
    log: () => {}
  });

  return {
    game,
    session,
    updates,
    endings,
    scheduled,
    cleared,
    now: () => time,
    setTime: (value) => {
      time = value;
    },
    advance: (ms) => {
      time += ms;
    }
  };
}

test('a session renders, arms a timer and walks every phase to the end', async () => {
  const r = rig();

  await r.session.refresh();
  assert.equal(r.updates.length, 1);
  assert.equal(r.scheduled.at(-1).ms, 60_000, 'submit window is armed');

  r.game.submit('u1', 'lie one');
  r.game.submit('u2', 'lie two');
  r.game.submit('u3', 'lie three');
  await r.session.refresh();
  assert.equal(r.game.phase, 'vote', 'all submissions close the phase early');
  assert.equal(r.scheduled.at(-1).ms, 45_000, 'vote window is armed');

  r.setTime(r.game.phaseEndsAt);
  await r.session.onTimer();
  assert.equal(r.game.phase, 'reveal');
  assert.equal(r.scheduled.at(-1).ms, 12_000, 'reveal window is armed');

  r.setTime(r.game.phaseEndsAt);
  await r.session.onTimer();
  assert.equal(r.game.phase, 'done');
  assert.equal(r.session.ended, true);
  assert.deepEqual(r.endings, ['done']);
});

test('a timer that fires early waits for the real deadline', async () => {
  const r = rig();
  await r.session.refresh();

  r.advance(5_000);
  await r.session.onTimer();
  assert.equal(r.game.phase, 'submit', 'nothing closed early');
  assert.ok(r.scheduled.length >= 2);
});

test('the last vote closes the round without waiting for the timer', async () => {
  const r = rig();
  await r.session.refresh();

  for (const id of ['u1', 'u2', 'u3']) r.game.submit(id, `lie from ${id}`);
  await r.session.refresh();

  const truth = r.game.options.find((option) => option.truth).key;

  r.game.vote('u1', truth);
  r.game.vote('u2', truth);
  await r.session.refresh();
  assert.equal(r.game.phase, 'vote');

  r.game.vote('u3', truth);
  await r.session.refresh();
  assert.equal(r.game.phase, 'reveal');
});

test('a deleted message ends the game instead of throwing', async () => {
  const r = rig();
  r.session.update = async () => {
    throw new Error('Unknown Message');
  };

  await r.session.refresh();
  assert.equal(r.session.ended, true);
  assert.deepEqual(r.endings, ['lost-message']);
});

test('finish is idempotent', async () => {
  const r = rig();
  await r.session.finish('one');
  await r.session.finish('two');
  assert.deepEqual(r.endings, ['one']);
});

test('the lobby expiry ends a game with no players', async () => {
  const r = rig({ start: false });
  await r.session.refresh();

  r.setTime(r.game.phaseEndsAt);
  await r.session.onTimer();

  assert.equal(r.game.phase, 'dead');
  assert.equal(r.session.ended, true);
  assert.deepEqual(r.endings, ['dead']);
});
