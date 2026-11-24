import { SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { MEDALS, safeName } from '../games/base.js';

const METRICS = [
  { name: 'games won', value: 'wins' },
  { name: 'people fooled', value: 'fooled' },
  { name: 'games played', value: 'games' }
];

const UNIT = { wins: 'wins', fooled: 'fooled', games: 'games' };

export default {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('the leaderboard for lying and truth-spotting')
    .addStringOption((option) =>
      option.setName('metric').setDescription('what to rank by').addChoices(...METRICS)
    ),

  ephemeral: false,

  async run({ interaction, store, invite }) {
    const metric = interaction.options.getString('metric') ?? 'wins';
    const rows = store.top({ guildId: interaction.guildId, metric, limit: 10 });
    const footer = 'this server only · finished games count';

    if (!rows.length) {
      return interaction.reply(
        toPayload(
          {
            color: 0x5b6c8f,
            title: 'the leaderboard',
            description: 'no finished games yet. somebody has to go first.\n\n`/bluff`',
            fields: [],
            footer,
            rows: []
          },
          { invite }
        )
      );
    }

    const lines = rows
      .map(
        (row, index) =>
          `${MEDALS[index] ?? `${index + 1}.`} **${safeName(row.name)}** · ${row[metric]} ${UNIT[metric]}`
      )
      .join('\n');

    return interaction.reply(
      toPayload(
        {
          color: 0xf2b544,
          title: `the leaderboard · ${METRICS.find((entry) => entry.value === metric)?.name ?? 'wins'}`,
          description: lines,
          fields: [],
          footer,
          rows: []
        },
        { invite }
      )
    );
  }
};
