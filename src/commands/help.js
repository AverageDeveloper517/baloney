import { SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';

const GAMES = [
  ['bluff', 'one truth, a pile of lies'],
  ['mostlikely', 'no typing, one tap per round'],
  ['trivia', 'five questions, four buttons'],
  ['wyr', 'would you rather, majority wins'],
  ['number', 'guess closest to the secret number'],
  ['duel', 'two players, rock paper scissors'],
  ['chain', 'one sentence each, vote for the best'],
  ['impostor', 'one player has a different word'],
  ['scatter', 'one letter, three categories']
];

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('all nine games, the party mode, and exactly what Baloney asks for'),

  ephemeral: false,

  async run({ interaction, invite }) {
    const games = GAMES.map(([name, blurb]) => `**/${name}** · ${blurb}`).join('\n');

    return interaction.reply(
      toPayload(
        {
          color: 0xf2b544,
          title: 'Baloney · a party in one message',
          description:
            '**nine games, zero setup.** run a command, press Join, and the whole game lives in one message that keeps editing itself.\n\n' +
            'no accounts, no API keys, no paid commands, nothing to configure. progress is cosmetic and earned by playing.',
          fields: [
            { name: 'pick a game', value: games, inline: false },
            {
              name: 'the whole night · /party',
              value:
                '**quick** · trivia, would you rather, number\n' +
                '**classic** · bluff, trivia, most likely to\n' +
                '**chaos** · scatter, impostor, chain\n' +
                '**marathon** · six games, one champion\n\n' +
                'One lobby, games back to back, 5/3/2/1 points per game.',
              inline: false
            },
            {
              name: 'your progress',
              value:
                '`/profile` level, coins and record\n' +
                '`/daily` a free coin bonus, streaks pay more\n' +
                '`/badges` twenty-eight things to earn\n' +
                '`/shop` and `/theme` cosmetic card colours\n' +
                '`/stats` and `/top` the receipts',
              inline: false
            },
            {
              name: 'for hosts',
              value:
                '`/setup` optional round count and pace for this server\n' +
                '`/invite` the exact invite URL and permission list\n\n' +
                '**Permissions:** View Channels, Send Messages, Embed Links, Send Messages in Threads. Nothing else. No message history, no member list, no content intent.',
              inline: false
            },
            {
              name: 'how a round works',
              value:
                'press **Join** in the lobby\n' +
                'the host presses **Start** (a full lobby starts itself)\n' +
                'answers and votes happen in private replies\n' +
                'the card updates in place, then shows the next phase',
              inline: false
            }
          ],
          footer: 'free forever · self-host or invite · every game is one message',
          rows: [],
          invite: true
        },
        { invite }
      )
    );
  }
};
