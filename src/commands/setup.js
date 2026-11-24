import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { toPayload } from '../ui.js';
import { GAME_DEFS } from '../games/index.js';
import { PACE } from '../games/base.js';

const PACE_CHOICES = [
  { name: 'fast · shorter windows', value: 'fast' },
  { name: 'standard · the default', value: 'standard' },
  { name: 'relaxed · longer windows', value: 'relaxed' }
];

const describe = (settings) => {
  const rounds = settings.rounds ? `${settings.rounds} (server default)` : 'each game decides';
  return `rounds · **${rounds}**\npace · **${settings.pace}** · timers ×${PACE[settings.pace] ?? 1}`;
};

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('optional server defaults for rounds and pace (needs Manage Server)')
    .addIntegerOption((option) =>
      option.setName('rounds').setDescription('default rounds per game, 1–8').setMinValue(1).setMaxValue(8)
    )
    .addStringOption((option) =>
      option.setName('pace').setDescription('how long the timers run').addChoices(...PACE_CHOICES)
    )
    .addBooleanOption((option) =>
      option.setName('reset').setDescription('go back to each game’s own defaults')
    ),

  async run({ interaction, store }) {
    const allowed = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
    if (!allowed) {
      return interaction.reply({
        content: '`/setup` needs Manage Server. changing the card defaults is the only thing that does — every game works without it.',
        flags: MessageFlags.Ephemeral
      });
    }

    const rounds = interaction.options.getInteger('rounds');
    const pace = interaction.options.getString('pace');
    const reset = interaction.options.getBoolean('reset');

    if (rounds !== null || pace !== null || reset) {
      await store.setGuild(interaction.guildId, {
        rounds: reset ? null : rounds ?? undefined,
        pace: reset ? 'standard' : pace ?? undefined
      });
    }

    const settings = store.guildSettings(interaction.guildId);
    const games = Object.entries(GAME_DEFS)
      .map(([kind, def]) => `**${kind}** · ${def.rounds} rounds, ${def.min}–${def.max} players`)
      .join('\n');

    return interaction.reply({
      ...toPayload({
        color: 0x3fa796,
        title: 'server setup · optional',
        description:
          '**nothing has to be configured.** these are defaults for `/bluff`, `/trivia` and friends; each command can still override its rounds.\n\n' +
          describe(settings),
        fields: [
          { name: 'the games', value: games, inline: false },
          {
            name: 'how to change it',
            value:
              '`/setup rounds:4` · every game opens with four rounds\n' +
              '`/setup pace:relaxed` · longer windows for a slow channel\n' +
              '`/setup reset:true` · back to each game’s own defaults',
            inline: false
          },
          {
            name: 'what it never changes',
            value: 'points, badges, coins, or anything stored about players. it is only how long a round waits.',
            inline: false
          }
        ],
        footer: 'Manage Server only · settings stay in one local file',
        rows: []
      }),
      flags: MessageFlags.Ephemeral
    });
  }
};
