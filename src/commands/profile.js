import { SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { bar, safeName } from '../games/base.js';
import { BADGES, THEME_BY_ID, badgeNames, levelProgress, profileLine } from '../meta.js';

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('your level, coins, badges and record in this server')
    .addUserOption((option) => option.setName('user').setDescription('look up someone else')),

  ephemeral: false,

  async run({ interaction, store, invite }) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const entry = store.get(interaction.guildId, target.id);
    const name = safeName(target.globalName ?? target.username, 'player');
    const { progress, accuracy } = profileLine(entry);
    const theme = THEME_BY_ID[entry.theme] ?? THEME_BY_ID.default;
    const owned = entry.badges.length;
    const recent = badgeNames(entry.badges.slice(-5)).join(' · ') || 'none yet';

    const fields = [
      {
        name: 'level',
        value:
          `**${progress.level}** · ${bar(progress.into, progress.span, 10)}\n` +
          `${progress.into}/${progress.span} xp · ${Math.max(0, progress.next - entry.xp)} to level ${progress.level + 1}`,
        inline: false
      },
      {
        name: 'record',
        value:
          `${entry.games} game${entry.games === 1 ? '' : 's'} · ${entry.wins} win${entry.wins === 1 ? '' : 's'} · ${percent(entry.wins, entry.games)}%\n` +
          `${entry.fooled} fooled · ${entry.found} truths found · ${accuracy}% quiz accuracy`,
        inline: false
      },
      {
        name: 'collection',
        value:
          `**${entry.coins}** coins · theme **${theme.name}**\n` +
          `${owned}/${BADGES.length} badges\n${recent}`,
        inline: false
      }
    ];

    if (!entry.games) {
      fields.push({
        name: 'start here',
        value: 'no finished games yet. `/trivia` takes ninety seconds, `/party quick` covers three games.',
        inline: false
      });
    }

    return interaction.reply(
      toPayload(
        {
          color: theme.color,
          title: `${name} · profile`,
          description: entry.games
            ? `level ${progress.level} · ${entry.coins} coins · ${owned} badges`
            : 'a clean slate. everybody starts at level 1.',
          fields,
          footer: 'this server only · `/daily` for free coins',
          rows: [],
          invite: true
        },
        { invite }
      )
    );
  }
};
