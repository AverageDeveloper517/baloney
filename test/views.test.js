import test from 'node:test';
import assert from 'node:assert/strict';

import { table, assertPayload, CLOCK, INVITE, IDS } from '../test-support/helpers.js';
import { GAME_DEFS } from '../src/games/index.js';
import { toPayload } from '../src/ui.js';

const KINDS = Object.keys(GAME_DEFS);

/** Put a legal action in for every active player, whatever the phase wants. */
function fill(game) {
  const active = game.active();
  const ids = active.map((player) => player.id);

  switch (game.kind) {
    case 'bluff':
      if (game.phase === 'submit') for (const id of ids) game.submit(id, { lie: `a lie from ${id}` });
      if (game.phase === 'vote') {
        for (const id of ids) {
          const option = game.options.find((entry) => !entry.authors.includes(id));
          if (option) game.vote(id, option.key);
        }
      }
      break;

    case 'mostlikely':
      if (game.phase === 'vote') {
        for (const [index, id] of ids.entries()) game.vote(id, ids[(index + 1) % ids.length]);
      }
      break;

    case 'trivia':
      if (game.phase === 'play') {
        for (const [index, id] of ids.entries()) game.vote(id, String(index % 4));
      }
      break;

    case 'wyr':
      if (game.phase === 'play') {
        for (const [index, id] of ids.entries()) game.vote(id, index % 2 ? 'b' : 'a');
      }
      break;

    case 'number':
      if (game.phase === 'play') {
        for (const [index, id] of ids.entries()) game.submit(id, { number: String(20 + index) });
      }
      break;

    case 'duel':
      if (game.phase === 'play') {
        game.vote(ids[0], 'rock');
        game.vote(ids[1], 'paper');
      }
      break;

    case 'chain':
      if (game.phase === 'submit') for (const [index, id] of ids.entries()) game.submit(id, { line: `line ${index} from ${id}` });
      if (game.phase === 'vote') {
        for (const id of ids) {
          const option = game.options.find((entry) => entry.authorId !== id);
          if (option) game.vote(id, option.key);
        }
      }
      break;

    case 'impostor':
      if (game.phase === 'brief') for (const id of ids) game.markSeen(id);
      if (game.phase === 'clue') for (const [index, id] of ids.entries()) game.submit(id, { clue: `clue ${index}` });
      if (game.phase === 'vote') {
        for (const [index, id] of ids.entries()) {
          const target = ids[(index + 1) % ids.length];
          if (target !== id) game.vote(id, target);
        }
      }
      break;

    case 'scatter': {
      if (game.phase === 'play') {
        const letter = game.letter;
        for (const [index, id] of ids.entries()) {
          game.submit(id, {
            c0: `${letter}ap${index}`,
            c1: `${letter}it${index}`,
            c2: `${letter}op${index}`
          });
        }
      }
      break;
    }

    default:
      break;
  }
}

test('every game renders its lobby, every action phase and its final card', () => {
  for (const kind of KINDS) {
    const def = GAME_DEFS[kind];
    const players = Math.min(def.max, 10);

    const lobby = table(kind, { players, start: false });
    assert.equal(lobby.phase, 'lobby');
    assertPayload(lobby.view());

    const lobbyPayload = toPayload(lobby.view());
    const ids = lobbyPayload.components.flatMap((row) => row.components.map((button) => button.data.custom_id));
    assert.ok(ids.includes(`${def.ns}:${lobby.id}:join`), `${kind} lobby has a join button`);
    assert.ok(ids.includes(`${def.ns}:${lobby.id}:start`), `${kind} lobby has a start button`);

    const game = table(kind, { players });
    const phases = new Set();

    for (let step = 0; step < 60; step += 1) {
      assert.ok(game.phase !== 'dead', `${kind} should not time out during a legal game`);
      phases.add(game.phase);

      const payload = assertPayload(game.view(), {
        invite: INVITE,
        expectInvite: Boolean(game.view().invite)
      });

      if (game.phase === 'done') {
        assert.equal(payload.components.some((row) => row.components.some((button) => !button.data.url)), false, `${kind} final has no dead buttons`);
        break;
      }

      fill(game);
      const moved = game.advanceIfReady(CLOCK);
      assertPayload(game.view());

      if (!moved && game.phase !== 'done') {
        assert.ok(game.phaseEndsAt, `${kind} has a deadline in ${game.phase}`);
        game.tick(game.phaseEndsAt);
      }
    }

    assert.equal(game.phase, 'done', `${kind} reaches a final card`);
    assert.ok(phases.has('done'), `${kind} covered the final card`);
    assert.ok(phases.has('play') || phases.has('submit') || phases.has('vote') || phases.has('brief'), `${kind} covered an action phase`);
  }
});

test('every write form is a gm: modal with one to five short inputs', () => {
  const cases = [
    ['bluff', 'submit'],
    ['number', 'play'],
    ['chain', 'submit'],
    ['impostor', 'clue'],
    ['scatter', 'play']
  ];

  for (const [kind, phase] of cases) {
    const game = table(kind, { players: 3 });
    if (kind === 'impostor') {
      for (const id of ['u1', 'u2', 'u3']) game.markSeen(id);
      game.advanceIfReady(CLOCK);
    }
    assert.equal(game.phase, phase, `${kind} is in ${phase}`);

    const form = game.writeForm();
    assert.ok(form, `${kind} has a form`);
    assert.match(form.customId, /^gm:/);
    assert.ok(form.title.length > 0 && form.title.length <= 45);
    assert.ok(form.inputs.length >= 1 && form.inputs.length <= 5);
    for (const input of form.inputs) {
      assert.ok(input.label.length > 0 && input.label.length <= 45);
      assert.ok((input.placeholder ?? '').length <= 100);
    }
  }
});

test('a maximum table with maximum-length names still fits every screen', () => {
  const name = 'a very long player name that should be cut down to size';

  for (const kind of ['bluff', 'trivia', 'chain', 'impostor']) {
    const game = table(kind, { players: 10 });
    for (const player of game.players) player.name = name;
    if (kind === 'impostor') {
      for (const id of IDS.slice(0, 10)) game.markSeen(id);
      game.advanceIfReady(CLOCK);
    }
    assertPayload(game.view());

    if (kind === 'bluff') {
      for (const player of game.players) game.submit(player.id, { lie: 'x'.repeat(400) });
      game.advanceIfReady(CLOCK);
    }
    if (kind === 'chain') {
      for (const player of game.players) game.submit(player.id, { line: 'y'.repeat(400) });
      game.advanceIfReady(CLOCK);
    }
    assertPayload(game.view());
  }
});

test('the invite button only appears when an invite is supplied', () => {
  const game = table('trivia', { players: 3, rounds: 1 });
  game.vote('u1', '0');
  game.vote('u2', '1');
  game.vote('u3', '2');
  game.advanceIfReady(CLOCK);
  game.tick(game.phaseEndsAt);

  const without = toPayload(game.view());
  assert.equal(without.components.length, 0);

  const withInvite = toPayload(game.view(), { invite: INVITE });
  const last = withInvite.components.at(-1).components[0].data;
  assert.equal(last.url, INVITE);
});

test('player-written text cannot inject a ping or a mention', () => {
  const game = table('bluff', { players: 3, rounds: 1 });
  game.submit('u1', { lie: '@everyone look at this' });
  game.submit('u2', { lie: '<@123456789012345678> hi' });
  game.submit('u3', { lie: '```discord.gg/example```' });
  game.advanceIfReady(CLOCK);

  const payload = assertPayload(game.view());
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assert.equal(JSON.stringify(payload.embeds[0].data).includes('<@123456789012345678>'), false);
  assert.equal(JSON.stringify(payload.embeds[0].data).includes('@everyone'), false);
});

test('a cancelled or timed-out lobby renders an honest closed card', () => {
  for (const kind of ['trivia', 'chain', 'scatter']) {
    const game = table(kind, { players: 2, start: false });
    game.cancel();
    const payload = assertPayload(game.view());
    assert.equal(payload.embeds[0].data.title, 'nobody started');
    assert.match(payload.embeds[0].data.footer.text, /\/help/);
    assert.equal(payload.components.length, 0);
  }
});
