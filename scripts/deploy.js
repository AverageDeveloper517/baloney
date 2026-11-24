import { REST, Routes } from 'discord.js';
import { fileURLToPath } from 'node:url';

import { loadEnv } from '../src/env.js';
import { loadCommands } from '../src/loader.js';

loadEnv();

const token = process.env.DISCORD_TOKEN?.trim();
const clientId = process.env.CLIENT_ID?.trim();
const guildId = process.env.GUILD_ID?.trim();

if (!token || !clientId) {
  console.error('DISCORD_TOKEN and CLIENT_ID are both required to register commands.');
  console.error('Run `npm run doctor` for the checklist.');
  process.exit(1);
}

const commands = await loadCommands(fileURLToPath(new URL('../src/commands/', import.meta.url)));
const body = [...commands.values()].map((command) => command.data.toJSON());

const rest = new REST({ version: '10' }).setToken(token);
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

try {
  const data = await rest.put(route, { body });
  console.log(
    `registered ${data.length} command(s) ${guildId ? `in guild ${guildId}` : 'globally'}: ${data
      .map((entry) => `/${entry.name}`)
      .join(' ')}`
  );
  if (!guildId) console.log('global commands can take up to an hour to appear. set GUILD_ID for instant updates.');
} catch (err) {
  console.error(`deploy failed: ${err.message}`);
  process.exit(1);
}
