import { SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('how Baloney works, and what it asks for'),

  ephemeral: false,

  async run({ interaction, invite }) {
    return interaction.reply(
      toPayload(
        {
          color: 0xf2b544,
          title: 'Baloney',
          description:
            '**a party in one message.** one prompt has a real answer; every other option was written by someone in the channel.\n\n' +
            'write a lie that sounds true. then vote for the answer you think is real.',
          fields: [
            {
              name: 'play in twenty seconds',
              value:
                '`/bluff` opens a lobby\npress **Join** · the host presses **Start**\nwrite a lie, then vote for the truth\n\n' +
                '`/mostlikely` is the no-typing version: one tap per round.'
            },
            {
              name: 'the two games',
              value:
                '**Bluff** · 3 rounds by default · 60s to write · 45s to vote\n' +
                '**Most likely to** · 3 rounds · 35s to vote · about two minutes total\n\n' +
                'Both support 3–10 players and run entirely in the channel message.'
            },
            {
              name: 'scoring',
              value:
                'find the truth · **+1000**\n' +
                'each person who falls for your lie · **+500**\n' +
                'most likely to · majority takes **+1**'
            },
            {
              name: 'what it asks for',
              value:
                'Send Messages and Embed Links in the channels you use.\n' +
                'No admin, no message history, no privileged intents, no accounts, no API keys, no paid commands.'
            }
          ],
          footer: 'one game = one message · `/stats` and `/top` keep the receipts',
          rows: [],
          invite: true
        },
        { invite }
      )
    );
  }
};
