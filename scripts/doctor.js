import { existsSync } from 'node:fs';

import { loadEnv } from '../src/env.js';
import { inviteUrl, PERMISSION_NAMES, PERMISSION_TOTAL, NOT_REQUESTED, SCOPES } from '../src/permissions.js';
import { PACK_NAMES, PROMPT_COUNT } from '../src/content/prompts.js';
import { SITUATION_COUNT } from '../src/content/situations.js';
import { TRIVIA_COUNT } from '../src/content/trivia.js';
import { WYR_COUNT } from '../src/content/wyr.js';
import { IMPOSTOR_COUNT } from '../src/content/impostor.js';
import { SCATTER_CATEGORY_COUNT, SCATTER_LETTER_COUNT } from '../src/content/scatter.js';
import { CHAIN_OPENER_COUNT } from '../src/content/chain.js';
import { GAME_KEYS } from '../src/games/index.js';
import { PARTY_PLAYLISTS } from '../src/party.js';

loadEnv();

const has = (value) => Boolean(value && value.trim());
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const ownerId = process.env.OWNER_ID;

const line = (ok, label, detail = '') =>
  console.log(`${ok ? ' ok ' : '  - '} ${label}${detail ? `  ${detail}` : ''}`);

console.log('\nbaloney · setup check · v2\n');

line(Number(process.versions.node.split('.')[0]) >= 18, 'node', `v${process.versions.node}`);
line(existsSync('.env'), '.env file', existsSync('.env') ? 'found' : 'missing — copy .env.example to .env');
line(has(token), 'DISCORD_TOKEN', has(token) ? `set (${token.trim().length} chars)` : 'missing');
line(has(clientId), 'CLIENT_ID', has(clientId) ? clientId.trim() : 'missing — invite links stay hidden');
if (has(ownerId)) line(true, 'OWNER_ID', ownerId.trim());

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
line(true, 'games', `${GAME_KEYS.length} · ${GAME_KEYS.join(', ')}`);
line(true, 'party playlists', `${Object.keys(PARTY_PLAYLISTS).length} · ${Object.keys(PARTY_PLAYLISTS).join(', ')}`);
line(true, 'bluff prompts', `${PROMPT_COUNT} across ${PACK_NAMES.length} packs`);
line(true, 'most likely to', `${SITUATION_COUNT} situations`);
line(true, 'trivia', `${TRIVIA_COUNT} questions`);
line(true, 'would you rather', `${WYR_COUNT} pairs`);
line(true, 'impostor', `${IMPOSTOR_COUNT} word pairs`);
line(true, 'chain', `${CHAIN_OPENER_COUNT} openers`);
line(true, 'scatter', `${SCATTER_CATEGORY_COUNT} categories · ${SCATTER_LETTER_COUNT} letters`);
line(true, 'gateway intents', 'Guilds only — nothing privileged to enable');

console.log('\nnext\n');
if (!has(token) || !has(clientId)) {
  console.log('  1. create an application at https://discord.com/developers/applications');
  console.log('  2. copy the bot token and the application id into .env');
  console.log('  3. npm run deploy      (registers all 21 commands)');
  console.log('  4. npm start           (runs the bot)');
} else {
  console.log('  npm run deploy   register the 21 slash commands');
  console.log('  npm start        run the bot');
  console.log('  npm test         run the offline suite (120 tests)');
}
console.log('');
