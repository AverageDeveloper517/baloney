import { SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { safeName } from '../games/base.js';

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('games played, games won, and how many people fell for your lies')
    .addUserOption((option) => option.setName('user').setDescription('look up someone else')),

  ephemeral: false,

  async run({ interaction, store, invite }) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const stats = store.get(interaction.guildId, target.id);
    const name = safeName(target.globalName ?? target.username, 'player');
    const footer = 'this server only · finished games count';

    if (!stats.games) {
      return interaction.reply(
        toPayload(
          {
            color: 0x5b6c8f,
            title: `${name} · the record`,
            description: 'no finished games yet.\n\n`/bluff` is the long game. `/mostlikely` takes two minutes.',
            fields: [],
            footer,
            rows: []
          },
          { invite }
        )
      );
    }

    const winRate = percent(stats.wins, stats.games);
    const average = (stats.fooled / stats.games).toFixed(1);

    return interaction.reply(
      toPayload(
        {
          color: 0x3fa796,
          title: `${name} · the record`,
          description: `${stats.games} game${stats.games === 1 ? '' : 's'} · ${stats.wins} win${stats.wins === 1 ? '' : 's'} · ${winRate}% win rate`,
          fields: [
            {
              name: 'lying',
              value: `${stats.fooled} people fooled\n${average} per game\nbest single bluff · ${stats.best} vote${stats.best === 1 ? '' : 's'}`,
              inline: true
            },
            {
              name: 'spotting',
              value: `${stats.found} truth${stats.found === 1 ? '' : 's'} found\n${stats.rounds} rounds played`,
              inline: true
            }
          ],
          footer,
          rows: []
        },
        { invite }
      )
    );
  }
};
