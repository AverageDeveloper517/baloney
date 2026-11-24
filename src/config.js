import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

export const config = {
  root,
  token: text(process.env.DISCORD_TOKEN),
  clientId: text(process.env.CLIENT_ID),
  guildId: text(process.env.GUILD_ID),
  ownerId: text(process.env.OWNER_ID),
  dataFile: resolve(root, text(process.env.DATA_FILE) ?? 'data/stats.json'),
  prefix: text(process.env.COMMAND_PREFIX) // reserved; the bot is slash-only
};

export function requireToken() {
  if (!config.token) {
    throw new Error(
      'DISCORD_TOKEN is missing. Copy .env.example to .env and paste your bot token.\n' +
        'Run `npm run doctor` for the full checklist.'
    );
  }
  return config.token;
}
