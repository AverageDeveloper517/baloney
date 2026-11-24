import { SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { THEMES, ownsTheme, themeColor } from '../meta.js';

export default {
  data: new SlashCommandBuilder().setName('shop').setDescription('spend coins on cosmetic card colours, nothing else'),

  ephemeral: false,

  async run({ interaction, store, invite }) {
    const entry = store.get(interaction.guildId, interaction.user.id);

    const lines = THEMES.map((theme) => {
      const owned = ownsTheme(entry, theme.id);
      const equipped = entry.theme === theme.id;
      const state = equipped ? 'equipped' : owned ? 'owned' : `${theme.price} coins`;
      return `**${theme.name}** · ${state}\n${theme.blurb}`;
    }).join('\n\n');

    return interaction.reply(
      toPayload(
        {
          color: themeColor(entry.theme),
          title: 'the shop · cosmetic only',
          description: `you have **${entry.coins}** coins.\n\n${lines}`,
          fields: [
            {
              name: 'how to buy',
              value: '`/theme id:<name>` buys it if you have the coins, then equips it. buying is permanent.',
              inline: false
            },
            {
              name: 'how to earn',
              value:
                'every game pays coins, wins pay more, `/daily` pays every day and streaks add a bonus. nothing costs real money and nothing is locked behind a purchase.',
              inline: false
            }
          ],
          footer: 'coins are earned by playing · themes change the card colour only',
          rows: [],
          invite: true
        },
        { invite }
      )
    );
  }
};
