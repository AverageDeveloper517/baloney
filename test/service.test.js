import test from 'node:test';
import assert from 'node:assert/strict';

import { createGameService } from '../src/game-service.js';
import { INVITE, memoryStore, fake } from '../test-support/helpers.js';

function rig() {
  let now = 10_000;
  const timers = {
    set: (fn, ms) => ({ fn, ms }),
    clear: () => {}
  };
  const logs = [];
  const store = memoryStore();

  const service = createGameService({
    store,
    invite: INVITE,
    clock: () => now,
    timers,
    log: (message) => logs.push(message)
  });

  return {
    service,
    store,
    logs,
    now: () => now,
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

async function click(r, game, id, action) {
  const press = fake({ id, customId: `bl:${game.id}:${action}` });
  await r.service.handleButton(press.interaction);
  return press;
}

async function join(r, game, id) {
  const press = fake({ id, customId: `bl:${game.id}:join` });
  await r.service.handleButton(press.interaction);
  return press;
}

async function startRound(r, game) {
  const press = fake({ id: game.hostId, customId: `bl:${game.id}:start` });
  await r.service.handleButton(press.interaction);
  assert.equal(game.phase, 'submit');
}

async function submit(r, game, id, lie) {
  const write = fake({ id, customId: `bl:${game.id}:write` });
  await r.service.handleButton(write.interaction);
  assert.equal(write.modalShows.length, 1, 'the write button opens a modal');

  const send = fake({ id, customId: `gm:${game.id}`, values: { lie } });
  await r.service.handleModal(send.interaction);
  return { write, send };
}

test('a complete bluff game runs through buttons, a modal and the timer', async () => {
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
  assert.equal(r.service.userGames.has('u1'), false, 'the player is not locked to anything');

  const one = r.store.get('g1', 'u1');
  assert.equal(one.games, 1);
  assert.equal(one.wins, 1, 'a three-way tie is a three-way win');
  assert.equal(one.kinds[0], 'bluff');
  assert.ok(one.xp > 0 && one.coins > 0);
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

  const hostCancel = fake({ id: 'u1', customId: `bl:${game.id}:cancel` });
  await r.service.handleButton(hostCancel.interaction);
  assert.equal(r.service.activeIn('c1'), null, 'a cancelled lobby frees the channel');
  assert.equal(r.store.get('g1', 'u1').games, 0, 'a cancelled lobby records nothing');
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
  const vote = fake({ id: 'u1', customId: `bl:${game.id}:v:${own}` });
  await r.service.handleButton(vote.interaction);

  assert.match(vote.replies[0].content, /yours/);
  assert.equal(game.votes.has('u1'), false);
});

test('a full lobby starts itself and an old button is refused', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });
  await r.service.startGame({ interaction: host.interaction, kind: 'mostlikely', rounds: 1 });
  const game = r.service.activeIn('c1').game;

  for (let i = 2; i <= 10; i += 1) {
    const press = fake({ id: `u${i}`, customId: `ml:${game.id}:join` });
    await r.service.handleButton(press.interaction);
  }

  assert.equal(game.size, 10);
  assert.equal(game.phase, 'vote', 'the tenth player fills the room and starts the game');

  const stale = fake({ id: 'u4', customId: 'ml:aaaaaa:join' });
  await r.service.handleButton(stale.interaction);
  assert.match(stale.replies[0].content, /ended/);
});

test('a failed post does not leave the host locked out of every channel', async () => {
  const r = rig();
  const host = fake({ id: 'u1', failReply: 'Missing Permissions' });

  await assert.rejects(
    r.service.startGame({ interaction: host.interaction, kind: 'bluff', rounds: 1 }),
    /Missing Permissions/
  );

  assert.equal(r.service.sessions.size, 0, 'no half-built game is kept');
  assert.equal(r.service.userGames.has('u1'), false, 'the player is free to try elsewhere');

  const retry = fake({ id: 'u1', channelId: 'c2' });
  await r.service.startGame({ interaction: retry.interaction, kind: 'bluff', rounds: 1 });
  assert.equal(r.service.activeIn('c2').game.hostId, 'u1');
});

test('a forged write button cannot crash a button-only game', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });
  await r.service.startGame({ interaction: host.interaction, kind: 'mostlikely', rounds: 1 });
  const game = r.service.activeIn('c1').game;

  const forged = fake({ id: 'u1', customId: `ml:${game.id}:write` });
  await r.service.handleButton(forged.interaction);

  assert.match(forged.replies[0].content, /buttons/);
});

test('a trivia game routes buttons, awards points and stores the quiz record', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });
  await r.service.startGame({ interaction: host.interaction, kind: 'trivia', rounds: 1 });
  const session = r.service.activeIn('c1');
  const game = session.game;

  for (const id of ['u2', 'u3']) {
    const press = fake({ id, customId: `tr:${game.id}:join` });
    await r.service.handleButton(press.interaction);
  }

  const start = fake({ id: 'u1', customId: `tr:${game.id}:start` });
  await r.service.handleButton(start.interaction);
  assert.equal(game.phase, 'play');

  const correct = game.correctIndex;
  for (const [id, choice] of [
    ['u1', correct],
    ['u2', correct],
    ['u3', (correct + 1) % 4]
  ]) {
    const vote = fake({ id, customId: `tr:${game.id}:v:${choice}` });
    await r.service.handleButton(vote.interaction);
    assert.match(vote.replies[0].content, /vote locked · [A-D]/);
  }

  assert.equal(game.phase, 'reveal');
  r.setNow(game.phaseEndsAt);
  await session.onTimer();
  assert.equal(session.ended, true);

  assert.equal(r.store.get('g1', 'u1').correct, 1);
  assert.equal(r.store.get('g1', 'u3').correct, 0);
  assert.equal(r.store.get('g1', 'u1').answers, 1);
  assert.ok(r.store.get('g1', 'u1').xp > r.store.get('g1', 'u3').xp);
});

test('an impostor game hands words out privately and reaches the reveal', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });
  await r.service.startGame({ interaction: host.interaction, kind: 'impostor', rounds: 1 });
  const session = r.service.activeIn('c1');
  const game = session.game;

  for (const id of ['u2', 'u3']) {
    const press = fake({ id, customId: `im:${game.id}:join` });
    await r.service.handleButton(press.interaction);
  }
  const start = fake({ id: 'u1', customId: `im:${game.id}:start` });
  await r.service.handleButton(start.interaction);
  assert.equal(game.phase, 'brief');

  for (const id of ['u1', 'u2', 'u3']) {
    const word = fake({ id, customId: `im:${game.id}:word` });
    await r.service.handleButton(word.interaction);
    assert.match(word.replies[0].content, /your word: \*\*/);
  }
  assert.equal(game.phase, 'clue', 'every word opened hands over to the clue phase');

  for (const id of ['u1', 'u2', 'u3']) {
    const write = fake({ id, customId: `im:${game.id}:write` });
    await r.service.handleButton(write.interaction);
    const send = fake({ id, customId: `gm:${game.id}`, values: { clue: `clue ${id}` } });
    await r.service.handleModal(send.interaction);
    assert.match(send.replies[0].content, /locked in · \d\/3/);
  }
  assert.equal(game.phase, 'vote');

  const impostor = game.impostorId;
  const fallback = ['u1', 'u2', 'u3'].find((id) => id !== impostor);
  for (const id of ['u1', 'u2', 'u3']) {
    const vote = fake({ id, customId: `im:${game.id}:v:${id === impostor ? fallback : impostor}` });
    await r.service.handleButton(vote.interaction);
  }
  assert.equal(game.phase, 'reveal');
  assert.equal(game.reveal.caught, true);

  r.setNow(game.phaseEndsAt);
  await session.onTimer();
  assert.equal(session.ended, true);
  assert.ok(r.store.get('g1', 'u1').games === 1);
});

test('party night chains games, pays party points and settles on the board', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });
  await r.service.startGame({ interaction: host.interaction, kind: 'party', playlist: 'quick', rounds: 1 });
  const session = r.service.activeIn('c1');
  const lobby = session.game;

  for (const id of ['u2', 'u3']) {
    const press = fake({ id, customId: `pt:${lobby.id}:join` });
    await r.service.handleButton(press.interaction);
  }
  const start = fake({ id: 'u1', customId: `pt:${lobby.id}:start` });
  await r.service.handleButton(start.interaction);

  assert.equal(session.game.kind, 'trivia', 'the lobby hands over to the first game');
  assert.equal(r.store.size, 0, 'the lobby itself settles nothing');

  let game = session.game;
  game.vote('u1', String(game.correctIndex));
  game.vote('u2', String((game.correctIndex + 1) % 4));
  game.vote('u3', String((game.correctIndex + 2) % 4));
  await session.refresh();
  r.setNow(game.phaseEndsAt);
  await session.onTimer();
  assert.equal(session.game.kind, 'party-break');

  const breakCard = session.game;
  r.setNow(breakCard.phaseEndsAt);
  await session.onTimer();
  assert.equal(session.game.kind, 'wyr');

  game = session.game;
  game.vote('u1', 'a');
  game.vote('u2', 'a');
  game.vote('u3', 'b');
  await session.refresh();
  r.setNow(game.phaseEndsAt);
  await session.onTimer();
  assert.equal(session.game.kind, 'party-break');

  const secondBreak = session.game;
  r.setNow(secondBreak.phaseEndsAt);
  await session.onTimer();
  assert.equal(session.game.kind, 'number');

  game = session.game;
  for (const [index, id] of ['u1', 'u2', 'u3'].entries()) {
    game.submit(id, { number: String(30 + index) });
  }
  await session.refresh();
  r.setNow(game.phaseEndsAt);
  await session.onTimer();

  assert.equal(session.ended, true);

  const one = r.store.get('g1', 'u1');
  assert.equal(one.games, 3, 'trivia, would you rather and number all count');
  assert.ok(one.kinds.includes('trivia'));
  assert.ok(one.kinds.includes('wyr'));
  assert.ok(one.kinds.includes('number'));
  assert.ok(one.kinds.includes('party'));
  assert.ok(one.badges.includes('party-animal'));
});

test('the sweep frees sessions that outlive the safety window', async () => {
  const r = rig();
  const { session } = await startBluff(r);

  r.setNow(r.now() + 4 * 60 * 60_000);
  r.service.sweep();

  assert.equal(session.ended, true);
  assert.equal(r.service.sessions.has('c1'), false);
});

test('shutdown closes every session exactly once', async () => {
  const r = rig();
  const one = await startBluff(r);
  const other = fake({ id: 'u9', channelId: 'c2' });
  await r.service.startGame({ interaction: other.interaction, kind: 'mostlikely', rounds: 1 });
  const two = r.service.activeIn('c2');

  await r.service.close();
  assert.equal(one.session.ended, true);
  assert.equal(two.ended, true);
  assert.equal(r.service.sessions.size, 0);
  assert.equal(r.service.userGames.size, 0);
});

test('an unknown game is a programming error, not a Discord reply', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });

  await assert.rejects(
    r.service.startGame({ interaction: host.interaction, kind: 'mystery' }),
    /unknown game/
  );
  assert.equal(r.service.sessions.size, 0);
});

test('a game with too few players refuses to start with a useful message', async () => {
  const r = rig();
  const host = fake({ id: 'u1' });
  await r.service.startGame({ interaction: host.interaction, kind: 'chain', rounds: 1 });
  const game = r.service.activeIn('c1').game;

  for (const id of ['u2', 'u3']) {
    const press = fake({ id, customId: `ch:${game.id}:join` });
    await r.service.handleButton(press.interaction);
  }
  // Remove one player so the table is one short of chain's minimum.
  const leave = fake({ id: 'u3', customId: `ch:${game.id}:leave` });
  await r.service.handleButton(leave.interaction);

  const start = fake({ id: 'u1', customId: `ch:${game.id}:start` });
  await r.service.handleButton(start.interaction);

  assert.match(start.replies[0].content, /at least 3 players/);
  assert.equal(game.phase, 'lobby');
});
