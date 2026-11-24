import { SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { safeName } from '../games/base.js';
import { BADGES, THEME_BY_ID } from '../meta.js';

export default {
  data: new SlashCommandBuilder()
    .setName('badges')
    .setDescription('every badge in the game and which ones you have')
    .addUserOption((option) => option.setName('user').setDescription('look up someone else')),

  ephemeral: false,

  async run({ interaction, store, invite }) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const entry = store.get(interaction.guildId, target.id);
    const name = safeName(target.globalName ?? target.username, 'player');
    const owned = new Set(entry.badges);
    const theme = THEME_BY_ID[entry.theme] ?? THEME_BY_ID.default;

    const earned = BADGES.filter((badge) => owned.has(badge.id));
    const locked = BADGES.filter((badge) => !owned.has(badge.id));

    const earnedText = earned.length
      ? earned.map((badge) => `**${badge.name}** · ${badge.desc}`).join('\n')
      : 'nothing yet. the first game unlocks one.';

    const lockedText = locked.length
      ? locked
          .slice(0, 18)
          .map((badge) => `${badge.name} · ${badge.desc}`)
          .join('\n')
      : 'every badge earned. genuinely impressive.';

    const fields = [
      { name: `earned · ${earned.length}/${BADGES.length}`, value: earnedText, inline: false },
      {
        name: locked.length > 18 ? `still to earn · showing 18 of ${locked.length}` : 'still to earn',
        value: lockedText,
        inline: false
      }
    ];

    return interaction.reply(
      toPayload(
        {
          color: theme.color,
          title: `${name} · badges`,
          description: `${earned.length} of ${BADGES.length} earned · every badge is free and comes from playing.`,
          fields,
          footer: 'badges are cosmetic · no badge changes a game',
          rows: [],
          invite: true
        },
        { invite }
      )
    );
  }
};
