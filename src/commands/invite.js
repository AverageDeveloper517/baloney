import { SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { inviteUrl, PERMISSION_NAMES, PERMISSION_TOTAL, NOT_REQUESTED, SCOPES } from '../permissions.js';
import { config } from '../config.js';

export default {
  data: new SlashCommandBuilder().setName('invite').setDescription('the invite link and the exact permissions Baloney asks for'),

  ephemeral: false,

  async run({ interaction, invite }) {
    const url = invite ?? (config.clientId ? inviteUrl(config.clientId) : null);
    const perms = Object.keys(PERMISSION_NAMES).map((name) => `• ${name}`).join('\n');

    return interaction.reply(
      toPayload(
        {
          color: 0x9b5de5,
          title: 'invite Baloney',
          description: url
            ? `**${url}**\n\ncopy that link, pick a server, and the games are live. no dashboard, no setup wizard.`
            : 'The bot owner has not set `CLIENT_ID` yet, so there is no invite link to show. The permissions below are still the complete list.',
          fields: [
            { name: 'permissions it asks for', value: perms, inline: true },
            {
              name: 'and nothing else',
              value: NOT_REQUESTED.slice(0, 6).map((name) => `• no ${name.toLowerCase()}`).join('\n'),
              inline: true
            },
            {
              name: 'the numbers, for the curious',
              value:
                `permission integer · \`${PERMISSION_TOTAL}\`\n` +
                `scopes · \`${SCOPES.join(' ')}\`\n\n` +
                'These four permissions cover sending the game card, editing it, and embedding it. Games in threads need the thread permission.',
              inline: false
            }
          ],
          footer: 'no admin · no message history · no member intent · no data leaves the server',
          rows: [],
          invite: true
        },
        { invite: url }
      )
    );
  }
};
