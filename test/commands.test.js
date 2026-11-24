import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { loadCommands } from '../src/loader.js';
import { toPayload } from '../src/ui.js';

const INVITE = 'https://discord.com/oauth2/authorize?client_id=1&scope=bot';
const commands = await loadCommands(fileURLToPath(new URL('../src/commands/', import.meta.url)));

function interaction({ user = null, strings = {}, integers = {} } = {}) {
  const replies = [];
  return {
    replies,
    interaction: {
      user: user ?? { id: 'u1', username: 'sam', globalName: 'Sam' },
      options: {
        getUser: () => user,
        getString: (name) => strings[name] ?? null,
        getInteger: (name) => integers[name] ?? null
      },
      reply: async (payload) => {
        replies.push(payload);
        return payload;
      }
    }
  };
}

test('all five commands load with valid names and descriptions', () => {
  assert.deepEqual([...commands.keys()].sort(), ['bluff', 'help', 'mostlikely', 'stats', 'top']);

  for (const [name, command] of commands) {
    const data = command.data.toJSON();
    assert.equal(data.name, name);
    assert.match(data.name, /^[a-z0-9-]{1,32}$/);
    assert.ok(data.description.length > 0 && data.description.length <= 100, `${name} description length`);

    for (const option of data.options ?? []) {
      assert.ok(option.description.length <= 100, `${name} option description`);
      assert.match(option.name, /^[a-z0-9-]{1,32}$/);
    }
  }
});

test('/bluff and /mostlikely hand a clean game request to the service', async () => {
  const calls = [];
  const service = { startGame: async (args) => calls.push(args) };

  const bluff = interaction({ integers: { rounds: 4 } });
  await commands.get('bluff').run({ interaction: bluff.interaction, service });

  const likely = interaction({});
  await commands.get('mostlikely').run({ interaction: likely.interaction, service });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].kind, 'bluff');
  assert.equal(calls[0].rounds, 4);
  assert.equal(calls[1].kind, 'mostlikely');
  assert.equal(calls[1].rounds, 3, 'the default is three rounds');
});

test('/stats explains an empty record without a crash', async () => {
  const { interaction: i, replies } = interaction();
  const store = { get: () => ({ games: 0, wins: 0, rounds: 0, found: 0, fooled: 0, best: 0 }) };

  await commands.get('stats').run({ interaction: i, store, invite: INVITE });

  assert.equal(replies.length, 1);
  const embed = replies[0].embeds[0].data;
  assert.match(embed.title, /Sam/);
  assert.match(embed.description, /no finished games/);
  assert.equal(replies[0].components.length, 0);
});

test('/stats shows a real record with a win rate', async () => {
  const { interaction: i, replies } = interaction();
  const store = {
    get: () => ({ games: 4, wins: 2, rounds: 12, found: 5, fooled: 9, best: 3 })
  };

  await commands.get('stats').run({ interaction: i, store, invite: INVITE });

  const embed = replies[0].embeds[0].data;
  assert.match(embed.description, /4 games · 2 wins · 50% win rate/);
  assert.match(embed.fields[0].value, /9 people fooled/);
  assert.match(embed.fields[1].value, /5 truths found/);
});

test('/top handles an empty board and a populated one', async () => {
  const empty = interaction();
  await commands.get('top').run({
    interaction: empty.interaction,
    store: { top: () => [] },
    invite: INVITE
  });
  assert.match(empty.replies[0].embeds[0].data.description, /no finished games/);

  const filled = interaction({ strings: { metric: 'fooled' } });
  await commands.get('top').run({
    interaction: filled.interaction,
    store: {
      top: () => [
        { id: 'a', name: 'alex', wins: 1, fooled: 12, games: 3 },
        { id: 'b', name: 'sam', wins: 2, fooled: 4, games: 4 }
      ]
    },
    invite: INVITE
  });

  const embed = filled.replies[0].embeds[0].data;
  assert.match(embed.title, /people fooled/);
  assert.match(embed.description, /alex/);
  assert.match(embed.description, /12 fooled/);
});

test('/help fits in one card and carries the invite', async () => {
  const { interaction: i, replies } = interaction();
  await commands.get('help').run({ interaction: i, invite: INVITE });

  const payload = replies[0];
  const embed = payload.embeds[0].data;
  assert.ok(embed.fields.length >= 4);
  assert.ok(embed.description.length <= 4_096);
  assert.equal(payload.components.at(-1).components[0].data.url, INVITE);

  const withoutInvite = toPayload({
    color: 1,
    title: 'x',
    description: 'y',
    fields: [],
    footer: 'z',
    rows: []
  });
  assert.equal(withoutInvite.components.length, 0);
});
