import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bluff')
    .setDescription('one truth, a pile of lies. write one, then vote for the real answer')
    .addIntegerOption((option) =>
      option
        .setName('rounds')
        .setDescription('how many rounds (default 3)')
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false)
    ),

  async run({ interaction, service }) {
    const rounds = interaction.options.getInteger('rounds') ?? 3;
    await service.startGame({ interaction, kind: 'bluff', rounds });
  }
};
