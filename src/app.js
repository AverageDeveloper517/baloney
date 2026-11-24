import { fileURLToPath } from 'node:url';

import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';

import { config, requireToken } from './config.js';
import { openStore } from './store.js';
import { createGameService } from './game-service.js';
import { createRouter } from './router.js';
import { loadCommands } from './loader.js';
import { inviteUrl } from './permissions.js';
import { log } from './log.js';

const SWEEP_MS = 10 * 60_000;

export async function start() {
  const token = requireToken();
  const store = await openStore({ file: config.dataFile, log: log.warn });
  const invite = config.clientId ? inviteUrl(config.clientId) : null;

  const service = createGameService({ store, invite, log: log.info });
  const commands = await loadCommands(fileURLToPath(new URL('./commands/', import.meta.url)));

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.commands = commands;

  client.on(Events.InteractionCreate, createRouter({ client, service, store, invite, log }));

  client.once(Events.ClientReady, async (ready) => {
    log.ok(`online as ${ready.user.tag} · ${ready.guilds.cache.size} server(s) · ${commands.size} commands`);
    ready.user.setActivity('/bluff — start a game', { type: ActivityType.Playing });

    if (!invite) {
      log.warn('CLIENT_ID is not set, so invite links are hidden. `npm run doctor` explains it.');
    }
  });

  client.on(Events.Error, (err) => log.error(`gateway: ${err.message}`));

  const sweep = setInterval(() => service.sweep(), SWEEP_MS);
  sweep.unref();

  await client.login(token);

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    log.info(`${signal} — closing cleanly`);
    clearInterval(sweep);

    try {
      await service.close();
      await store.flush();
      await client.destroy();
    } catch (err) {
      log.warn(`shutdown: ${err.message}`);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (err) => log.error(`unhandled rejection: ${err?.stack ?? err}`));
  process.on('uncaughtException', (err) => log.error(`uncaught exception: ${err?.stack ?? err}`));

  return client;
}
