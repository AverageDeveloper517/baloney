import test from 'node:test';
import assert from 'node:assert/strict';

import { createGameService } from '../src/game-service.js';

function fake({ id = 'u1', channelId = 'c1', customId = null, lie = 'a lie', integers = {} } = {}) {
  const replies = [];
  const edits = [];
  const modals = [];
  let deferred = false;

  const message = {
    edit: async (payload) => {
      edits.push(payload);
    }
  };

  const interaction = {
    user: { id, username: id, globalName: id },
    member: { displayName: id },
    channelId,
    guildId: 'g1',
    customId,
    options: {
      getInteger: (name) => integers[name] ?? null,
      getString: () => null,
      getUser: () => null
    },
    fields: { getTextInputValue: () => lie },
    reply: async (payload) => {
      replies.push(payload);
      return { resource: { message } };
    },
    fetchReply: async () => message,
    deferUpdate: async () => {
      deferred = true;
    },
    showModal: async (modal) => {
      modals.push(modal);
    },
    isRepliable: () => true,
    replied: false,
    get deferred() {
      return deferred;
    }
  };

  return { interaction, replies, edits, modals, isDeferred: () => deferred };
}

function rig() {
  let now = 10_000;
  const timers = {
    set: (fn, ms) => ({ fn, ms }),
    clear: () => {}
  };
  const records = [];

  const store = {
    record: async (payload) => {
      records.push(payload);
    },
    get: () => ({ games: 0 }),
    top: () => []
  };

  const service = createGameService({
    store,
    clock: () => now,
    timers,
    log: () => {}
  });

  return {
    service,
    records,
    setNow: (value) => {
      now = value;
    }
  };
}

async function startBluff(r, hostId = 'u1') {
  const host = fake({ id: hostId });
  await r.service.startGame({ interaction: host.interaction, kind: 'bluff', rounds: 1 });
  const session = r.service.activeIn('c1');
  return { host, session, game: session.game };
}

async function join(r, game, id) {
  const click = fake({ id, customId: `bl:${game.id}:join` });
  await r.service.handleButton(click.interaction);
  return click;
}

async function startRound(r, game) {
  const click = fake({ id: game.hostId, customId: `bl:${game.id}:start` });
  await r.service.handleButton(click.interaction);
  assert.equal(game.phase, 'submit');
  return click;
}

async function submit(r, game, id, lie) {
  const write = fake({ id, customId: `bl:${game.id}:write` });
  await r.service.handleButton(write.interaction);
  assert.equal(write.modals.length, 1, 'the write button opens a modal');

  const modal = fake({ id, customId: `blm:${game.id}`, lie });
  await r.service.handleModal(modal.interaction);
  return { write, modal };
}

test('a complete game runs through buttons, a modal and the timer', async () => {
  const r = rig();
  const { host, session, game } = await startBluff(r);

  assert.equal(host.replies.length, 1, 'the game message is the command reply');
  assert.equal(game.size, 1);
  assert.equal(session.phase, 'lobby');

  await join(r, game, 'u2');
  await join(r, game, 'u3');
  assert.equal(game.size, 3);
  assert.ok(host.edits.length >= 2, 'the lobby card was edited in place, not spammed');

  await startRound(r, game);

  await submit(r, game, 'u1', 'a lie from one');
  await submit(r, game, 'u2', 'a lie from two');
  await submit(r, game, 'u3', 'a lie from three');
  assert.equal(game.phase, 'vote', 'the last answer closes the write window');

  const truth = game.options.find((option) => option.truth).key;
  for (const id of ['u1', 'u2', 'u3']) {
    const vote = fake({ id, customId: `bl:${game.id}:v:${truth}` });
    await r.service.handleButton(vote.interaction);
    assert.match(vote.replies[0].content, /vote locked/);
  }

  assert.equal(game.phase, 'reveal');
  r.setNow(game.phaseEndsAt);
  await session.onTimer();

  assert.equal(game.phase, 'done');
  assert.equal(r.service.sessions.has('c1'), false, 'the channel is free again');
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].rounds, 1);
  assert.deepEqual(r.records[0].winnerIds.sort(), ['u1', 'u2', 'u3'], 'a three-way tie is a three-way win');
});

test('one game per channel and one game per player', async () => {
  const r = rig();
  const { game } = await startBluff(r);

  const second = fake({ id: 'u9' });
  await r.service.startGame({ interaction: second.interaction, kind: 'mostlikely', rounds: 1 });
  assert.match(second.replies[0].content, /already running/);

  const other = fake({ id: 'u1', channelId: 'c2' });
  await r.service.startGame({ interaction: other.interaction, kind: 'mostlikely', rounds: 1 });
  assert.match(other.replies[0].content, /already in a game/);

  const wrongGame = fake({ id: 'u5', customId: `ml:${game.id}:join` });
  await r.service.handleButton(wrongGame.interaction);
  assert.match(wrongGame.replies[0].content, /wrong game/);
});

test('only the host can start or cancel', async () => {
  const r = rig();
  const { game } = await startBluff(r);
  await join(r, game, 'u2');
  await join(r, game, 'u3');

  const notHost = fake({ id: 'u2', customId: `bl:${game.id}:start` });
  await r.service.handleButton(notHost.interaction);
  assert.match(notHost.replies[0].content, /only the host/);
  assert.equal(game.phase, 'lobby');

  const cancel = fake({ id: 'u3', customId: `bl:${game.id}:cancel` });
  await r.service.handleButton(cancel.interaction);
  assert.match(cancel.replies[0].content, /only the host/);
  assert.equal(game.phase, 'lobby');
});

test('you cannot vote for your own lie through the button either', async () => {
  const r = rig();
  const { game } = await startBluff(r);
  await join(r, game, 'u2');
  await join(r, game, 'u3');
  await startRound(r, game);

  await submit(r, game, 'u1', 'the obvious lie');
  await submit(r, game, 'u2', 'another lie');
  await submit(r, game, 'u3', 'a third lie');

  const own = game.options.find((option) => option.authors.includes('u1')).key;
  const click = fake({ id: 'u1', customId: `bl:${game.id}:v:${own}` });
  await r.service.handleButton(click.interaction);

  assert.match(click.replies[0].content, /your lie/);
  assert.equal(game.votes.has('u1'), false);
});

test('a full lobby starts itself and an old button is refused', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });
  await r.service.startGame({ interaction: host.interaction, kind: 'mostlikely', rounds: 1 });
  const game = r.service.activeIn('c1').game;

  for (let i = 2; i <= 10; i += 1) {
    const click = fake({ id: `u${i}`, customId: `ml:${game.id}:join` });
    await r.service.handleButton(click.interaction);
  }

  assert.equal(game.size, 10);
  assert.equal(game.phase, 'vote', 'the tenth player fills the room and starts the game');

  const stale = fake({ id: 'u4', customId: 'ml:aaaaaa:join' });
  await r.service.handleButton(stale.interaction);
  assert.match(stale.replies[0].content, /ended/);
});

test('a failed post does not leave the host locked out of every channel', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });
  host.interaction.reply = async () => {
    throw new Error('Missing Permissions');
  };

  await assert.rejects(
    r.service.startGame({ interaction: host.interaction, kind: 'bluff', rounds: 1 }),
    /Missing Permissions/
  );

  assert.equal(r.service.sessions.size, 0, 'no half-built game is kept');
  assert.equal(r.service.userGames.has('u1'), false, 'the player is free to try elsewhere');

  // And the same channel is usable once the host retries somewhere that works.
  const retry = fake({ id: 'u1', channelId: 'c2' });
  await r.service.startGame({ interaction: retry.interaction, kind: 'bluff', rounds: 1 });
  assert.equal(r.service.activeIn('c2').game.hostId, 'u1');
});

test('a forged write button cannot crash a most likely game', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });
  await r.service.startGame({ interaction: host.interaction, kind: 'mostlikely', rounds: 1 });
  const game = r.service.activeIn('c1').game;

  const forged = fake({ id: 'u1', customId: `ml:${game.id}:write` });
  await r.service.handleButton(forged.interaction);

  assert.match(forged.replies[0].content, /does not take written answers/);
});
