import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { THEMES, equipTheme, ownsTheme, themeColor } from '../meta.js';

export default {
  data: new SlashCommandBuilder()
    .setName('theme')
    .setDescription('equip a cosmetic card colour, buying it with coins if needed')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('which theme (leave empty to see your collection)')
        .addChoices(...THEMES.map((theme) => ({ name: `${theme.name} · ${theme.price || 'free'}`, value: theme.id })))
    ),

  async run({ interaction, store }) {
    const id = interaction.options.getString('id');
    const entry = store.get(interaction.guildId, interaction.user.id);
    const name = interaction.user.globalName ?? interaction.user.username ?? 'player';

    if (!id) {
      const lines = THEMES.map((theme) => {
        const owned = ownsTheme(entry, theme.id);
        return `${theme.name} · ${owned ? 'owned' : `${theme.price} coins`}${entry.theme === theme.id ? ' · equipped' : ''}`;
      }).join('\n');

      return interaction.reply({
        ...toPayload({
          color: themeColor(entry.theme),
          title: 'your themes',
          description: `you have **${entry.coins}** coins.\n\n${lines}`,
          fields: [{ name: 'equip one', value: '`/theme id:<name>` · `/shop` explains how coins are earned', inline: false }],
          footer: 'cosmetic only · earned by playing',
          rows: []
        }),
        flags: MessageFlags.Ephemeral
      });
    }

    const result = await equipTheme({
      store,
      guildId: interaction.guildId ?? null,
      userId: interaction.user.id,
      name,
      id
    });

    if (!result.ok) {
      return interaction.reply({
        ...toPayload({
          color: 0xe4572e,
          title: 'not enough coins',
          description:
            `**${result.theme.name}** costs ${result.theme.price} coins and you have ${result.coins}.\n\n` +
            `you need **${result.need}** more. \`/daily\` and any game will get you there.`,
          fields: [],
          footer: 'nothing here needs real money',
          rows: []
        }),
        flags: MessageFlags.Ephemeral
      });
    }

    return interaction.reply({
      ...toPayload({
        color: result.theme.color,
        title: `${result.theme.name} · equipped`,
        description: result.bought
          ? `bought for ${result.theme.price} coins. every card you open in this server now uses this colour.`
          : `equipped. every card you open in this server now uses this colour.`,
        fields: [{ name: 'coins left', value: `${result.coins}`, inline: false }],
        footer: 'cosmetic only · `/theme` to swap again',
        rows: []
      }),
      flags: MessageFlags.Ephemeral
    });
  }
};
