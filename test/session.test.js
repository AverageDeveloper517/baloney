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
  const closes = [];

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
    onClose: async (finished, reason) => closes.push(reason),
    log: () => {}
  });

  return {
    game,
    session,
    updates,
    endings,
    closes,
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
  assert.deepEqual(r.endings, ['done'], 'the finished game is recorded once');
  assert.deepEqual(r.closes, ['done'], 'then the session closes');
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

test('a deleted message ends the game without pretending it finished', async () => {
  const r = rig();
  r.session.update = async () => {
    throw new Error('Unknown Message');
  };

  await r.session.refresh();
  assert.equal(r.session.ended, true);
  assert.deepEqual(r.closes, ['lost-message']);
  assert.deepEqual(r.endings, [], 'a lost message is not a finished game');
});

test('finish is idempotent and never records a game', async () => {
  const r = rig();
  await r.session.finish('one');
  await r.session.finish('two');
  assert.deepEqual(r.closes, ['one']);
  assert.deepEqual(r.endings, []);
});

test('the lobby expiry closes without recording a result', async () => {
  const r = rig({ start: false });
  await r.session.refresh();

  r.setTime(r.game.phaseEndsAt);
  await r.session.onTimer();

  assert.equal(r.game.phase, 'dead');
  assert.equal(r.session.ended, true);
  assert.deepEqual(r.closes, ['dead']);
  assert.deepEqual(r.endings, ['dead'], 'the hook sees the reason and can ignore it');
});

test('a long deadline is clamped to the largest safe timer', async () => {
  const r = rig();
  r.game.phaseEndsAt = r.now() + 10 ** 15;
  await r.session.refresh();

  assert.equal(r.scheduled.at(-1).ms, 2_000_000_000);
});

test('renders coalesce instead of overlapping', async () => {
  const r = rig();
  let active = 0;
  let peak = 0;
  const payloads = [];

  r.session.update = async (payload) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    payloads.push(payload);
    active -= 1;
  };

  const first = r.session.render();
  const second = r.session.render();
  await Promise.all([first, second]);

  assert.equal(peak, 1, 'only one edit is in flight at a time');
  assert.equal(payloads.length, 2, 'the second request still gets a fresh render');
});

test('planNext chains a successor game on the same session', async () => {
  const r = rig();
  const nextGame = new BluffGame({
    channelId: 'c1',
    hostId: 'u1',
    prompts: PROMPTS,
    rounds: 1,
    rng: () => 0.44,
    clock: () => r.now()
  });
  for (const id of ['u1', 'u2', 'u3']) nextGame.add({ id, name: id });
  nextGame.start();

  const seen = [];
  r.session.planNext = async (game, reason) => {
    seen.push(`${game.id}:${reason}`);
    return nextGame;
  };

  for (const id of ['u1', 'u2', 'u3']) r.game.submit(id, `lie ${id}`);
  await r.session.refresh();
  for (const id of ['u1', 'u2', 'u3']) r.game.vote(id, r.game.options.find((option) => option.truth).key);
  await r.session.refresh();

  r.setTime(r.game.phaseEndsAt);
  await r.session.onTimer();

  assert.equal(r.session.game, nextGame);
  assert.equal(r.session.ended, false);
  assert.deepEqual(seen, [`${r.game.id}:done`]);
  assert.equal(r.session.transitions, 1);
});

test('a planner that never stops is cut off by the transition guard', async () => {
  let time = 1_000;
  let closed = null;
  let transitions = 0;
  const logs = [];

  const loopGame = () => ({
    id: 'loop',
    kind: 'loop',
    phase: 'done',
    phaseEndsAt: null,
    createdAt: time,
    closed: true,
    size: 1,
    view: () => ({ color: 1, title: 'loop', description: 'loop', fields: [], rows: [] }),
    tick: () => {}
  });

  const session = new Session({
    game: loopGame(),
    now: () => time,
    timers: { set: () => ({}), clear: () => {} },
    update: async () => {},
    onEnd: async () => {},
    onClose: async (game, reason) => {
      closed = reason;
    },
    planNext: async () => {
      transitions += 1;
      return loopGame();
    },
    log: (message) => logs.push(message)
  });

  await session.refresh();

  assert.equal(session.ended, true);
  assert.equal(closed, 'loop-guard');
  assert.ok(transitions <= 16);
  assert.ok(logs.some((line) => /too many game transitions/.test(line)));
});
