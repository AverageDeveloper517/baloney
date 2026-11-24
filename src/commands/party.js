import { SlashCommandBuilder } from 'discord.js';

import { PARTY_PLAYLISTS } from '../party.js';

const CHOICES = Object.entries(PARTY_PLAYLISTS).map(([value, entry]) => ({
  name: `${entry.label} · ${entry.games.length} games`,
  value
}));

export default {
  data: new SlashCommandBuilder()
    .setName('party')
    .setDescription('one lobby, a whole night of games, one champion')
    .addStringOption((option) =>
      option.setName('playlist').setDescription('the lineup (default classic)').addChoices(...CHOICES)
    )
    .addIntegerOption((option) =>
      option.setName('rounds').setDescription('rounds per game (default: each game decides)').setMinValue(1).setMaxValue(5)
    ),

  async run({ interaction, service }) {
    const playlist = interaction.options.getString('playlist') ?? 'classic';
    const rounds = interaction.options.getInteger('rounds') ?? undefined;
    await service.startGame({ interaction, kind: 'party', playlist, rounds });
  }
};
