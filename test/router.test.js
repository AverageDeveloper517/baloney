import test from 'node:test';
import assert from 'node:assert/strict';

import { createRouter } from '../src/router.js';

function rig({ commands = new Map(), service = {}, store = {}, invite = 'https://example.test/invite' } = {}) {
  const logs = { info: [], error: [] };
  const log = {
    info: (message) => logs.info.push(message),
    error: (message) => logs.error.push(message)
  };

  const router = createRouter({
    client: { commands },
    service: {
      handleButton: async () => {},
      handleModal: async () => {},
      ...service
    },
    store,
    invite,
    log
  });

  return { router, logs };
}

function commandInteraction({ id = 'i1', name = 'bluff', replied = false, deferred = false } = {}) {
  const replies = [];
  const followUps = [];
  return {
    id,
    commandName: name,
    replied,
    deferred,
    isChatInputCommand: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    isRepliable: () => true,
    reply: async (payload) => replies.push(payload),
    followUp: async (payload) => followUps.push(payload),
    replies,
    followUps
  };
}

test('a chat input command is dispatched with the shared services', async () => {
  const calls = [];
  const commands = new Map([
    [
      'bluff',
      {
        run: async (args) => {
          calls.push(args);
        }
      }
    ]
  ]);
  const { router, logs } = rig({ commands });

  const interaction = commandInteraction();
  await router(interaction);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].interaction, interaction);
  assert.equal(calls[0].invite, 'https://example.test/invite');
  assert.equal(typeof calls[0].log.info, 'function');
  assert.deepEqual(logs.error, []);
});

test('an unknown command is ignored without replying', async () => {
  const { router } = rig();
  const interaction = commandInteraction({ name: 'nonsense' });

  await router(interaction);
  assert.deepEqual(interaction.replies, []);
});

test('the same interaction id is only handled once', async () => {
  let runs = 0;
  const commands = new Map([
    [
      'bluff',
      {
        run: async () => {
          runs += 1;
        }
      }
    ]
  ]);
  const { router, logs } = rig({ commands });

  await router(commandInteraction({ id: 'dupe-1' }));
  await router(commandInteraction({ id: 'dupe-1' }));

  assert.equal(runs, 1);
  assert.ok(logs.info.some((line) => /duplicate interaction dupe-1/.test(line)));
});

test('buttons and modals go straight to the service', async () => {
  const seen = [];
  const { router } = rig({
    service: {
      handleButton: async (interaction) => seen.push(`button:${interaction.customId}`),
      handleModal: async (interaction) => seen.push(`modal:${interaction.customId}`)
    }
  });

  await router({
    id: 'b1',
    customId: 'bl:abc:join',
    isChatInputCommand: () => false,
    isButton: () => true,
    isModalSubmit: () => false
  });
  await router({
    id: 'm1',
    customId: 'gm:abc',
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => true
  });

  assert.deepEqual(seen, ['button:bl:abc:join', 'modal:gm:abc']);
});

test('a handler crash is logged and answered once, without throwing', async () => {
  const commands = new Map([
    [
      'bluff',
      {
        run: async () => {
          throw new Error('the wheels came off');
        }
      }
    ]
  ]);
  const { router, logs } = rig({ commands });
  const interaction = commandInteraction();

  await router(interaction);

  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].content, /something broke/);
  assert.ok(logs.error.some((line) => line.includes('the wheels came off')));
});

test('after a deferred reply the error goes to followUp', async () => {
  const commands = new Map([
    [
      'bluff',
      {
        run: async () => {
          throw new Error('late failure');
        }
      }
    ]
  ]);
  const { router } = rig({ commands });
  const interaction = commandInteraction({ deferred: true });

  await router(interaction);

  assert.deepEqual(interaction.replies, []);
  assert.equal(interaction.followUps.length, 1);
});

test('an interaction that cannot be replied to never throws', async () => {
  const commands = new Map([
    [
      'bluff',
      {
        run: async () => {
          throw new Error('gone');
        }
      }
    ]
  ]);
  const { router, logs } = rig({ commands });
  const interaction = { ...commandInteraction(), isRepliable: () => false };

  await router(interaction);

  assert.deepEqual(interaction.replies, []);
  assert.equal(logs.error.length, 1);
});

test('a failing error reply is swallowed as well', async () => {
  const commands = new Map([
    [
      'bluff',
      {
        run: async () => {
          throw new Error('boom');
        }
      }
    ]
  ]);
  const { router } = rig({ commands });
  const interaction = {
    ...commandInteraction(),
    reply: async () => {
      throw new Error('interaction expired');
    }
  };

  await assert.doesNotReject(router(interaction));
});
