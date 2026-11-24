import { SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { safeName } from '../games/base.js';
import { levelProgress } from '../meta.js';

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('games played, games won, lies told and truths found')
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
            description: 'no finished games yet.\n\n`/trivia` takes ninety seconds. `/bluff` is the long game.',
            fields: [],
            footer,
            rows: [],
            invite: true
          },
          { invite }
        )
      );
    }

    const level = levelProgress(stats.xp);
    const average = (stats.fooled / stats.games).toFixed(1);
    const accuracy = percent(stats.correct, stats.answers);
    const kinds = stats.kinds.length ? stats.kinds.join(', ') : 'none recorded';

    return interaction.reply(
      toPayload(
        {
          color: 0x3fa796,
          title: `${name} · the record`,
          description:
            `level **${level.level}** · ${stats.games} game${stats.games === 1 ? '' : 's'} · ` +
            `${stats.wins} win${stats.wins === 1 ? '' : 's'} · ${percent(stats.wins, stats.games)}% win rate`,
          fields: [
            {
              name: 'lying',
              value:
                `${stats.fooled} people fooled\n` +
                `${average} per game\n` +
                `best single bluff · ${stats.best} vote${stats.best === 1 ? '' : 's'}`,
              inline: true
            },
            {
              name: 'spotting',
              value:
                `${stats.found} truth${stats.found === 1 ? '' : 's'} found\n` +
                `${stats.correct}/${stats.answers} quiz answers · ${accuracy}%\n` +
                `${stats.rounds} rounds played`,
              inline: true
            },
            { name: 'games tried', value: kinds, inline: false }
          ],
          footer,
          rows: [],
          invite: true
        },
        { invite }
      )
    );
  }
};
