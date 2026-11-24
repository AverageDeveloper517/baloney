import { existsSync } from 'node:fs';

import { loadEnv } from '../src/env.js';
import { inviteUrl, PERMISSION_NAMES, PERMISSION_TOTAL, NOT_REQUESTED, SCOPES } from '../src/permissions.js';
import { PROMPT_COUNT } from '../src/content/prompts.js';
import { SITUATION_COUNT } from '../src/content/situations.js';

loadEnv();

const has = (value) => Boolean(value && value.trim());
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

const line = (ok, label, detail = '') =>
  console.log(`${ok ? ' ok ' : '  - '} ${label}${detail ? `  ${detail}` : ''}`);

console.log('\nbaloney · setup check\n');

line(Number(process.versions.node.split('.')[0]) >= 18, 'node', `v${process.versions.node}`);
line(existsSync('.env'), '.env file', existsSync('.env') ? 'found' : 'missing — copy .env.example to .env');
line(has(token), 'DISCORD_TOKEN', has(token) ? `set (${token.trim().length} chars)` : 'missing');
line(has(clientId), 'CLIENT_ID', has(clientId) ? clientId.trim() : 'missing');

console.log('\ninvite link\n');
if (has(clientId)) {
  console.log(`  ${inviteUrl(clientId.trim())}\n`);
  console.log('  scopes:      ' + SCOPES.join(', '));
  console.log('  permissions: ' + Object.keys(PERMISSION_NAMES).join(', '));
  console.log('  integer:     ' + PERMISSION_TOTAL.toString());
  console.log('\n  not requested: ' + NOT_REQUESTED.join(', '));
} else {
  console.log('  add CLIENT_ID to .env, then run this again to print the invite link');
}

console.log('\ncontent\n');
line(true, 'bluff prompts', `${PROMPT_COUNT} prompts`);
line(true, 'most likely to', `${SITUATION_COUNT} situations`);
line(true, 'gateway intents', 'Guilds only — nothing privileged to enable');

console.log('\nnext\n');
if (!has(token) || !has(clientId)) {
  console.log('  1. create an application at https://discord.com/developers/applications');
  console.log('  2. copy the bot token and the application id into .env');
  console.log('  3. npm run deploy      (registers the commands)');
  console.log('  4. npm start           (runs the bot)');
} else {
  console.log('  npm run deploy   register the slash commands');
  console.log('  npm start        run the bot');
  console.log('  npm test         run the offline suite');
}
console.log('');
