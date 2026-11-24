import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { bar, safeName } from '../games/base.js';
import { claimDaily, levelProgress, themeColor } from '../meta.js';

export default {
  data: new SlashCommandBuilder().setName('daily').setDescription('claim free coins once a day, with a streak bonus'),

  async run({ interaction, store }) {
    const name = safeName(interaction.user.globalName ?? interaction.user.username, 'player');
    const result = await claimDaily({
      store,
      guildId: interaction.guildId ?? null,
      userId: interaction.user.id,
      name
    });

    const entry = result.entry ?? store.get(interaction.guildId ?? null, interaction.user.id);
    const level = levelProgress(entry.xp);
    const field = (value) => [{ name: 'your purse', value, inline: false }];

    const payload = result.ok
      ? {
          color: themeColor(entry.theme),
          title: `${name} · daily coins`,
          description:
            `**+${result.reward} coins** · day ${result.streak} of the streak\n\n` +
            'come back tomorrow and the bonus grows. miss a day and it starts again at one.',
          fields: field(
            `**${result.coins}** coins · level ${level.level}\n` +
              `${bar(level.into, level.span, 10)} ${level.into}/${level.span} xp\n` +
              `next daily · 30 coins + 5 for every streak day, up to 60`
          ),
          footer: 'free coins, cosmetic colours only · nothing here is for sale',
          rows: [],
          invite: true
        }
      : {
          color: 0x8d99ae,
          title: `${name} · already claimed`,
          description: `today's coins are already in the purse. the streak is at **${result.streak}**.\n\nthe next daily unlocks at midnight UTC.`,
          fields: field(`**${result.coins}** coins · level ${level.level}`),
          footer: 'free coins, cosmetic colours only · nothing here is for sale',
          rows: [],
          invite: true
        };

    return interaction.reply({
      ...toPayload(payload, { invite: null }),
      flags: MessageFlags.Ephemeral
    });
  }
};
