import { MessageFlags, SlashCommandBuilder, version as discordVersion } from 'discord.js';

import { toPayload } from '../ui.js';
import { config } from '../config.js';

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default {
  data: new SlashCommandBuilder().setName('debug').setDescription('runtime status, for the bot owner only'),

  async run({ interaction, service, store }) {
    if (!config.ownerId || interaction.user.id !== config.ownerId) {
      return interaction.reply({
        content: '`/debug` is reserved for the bot owner. everything it shows is visible in `/stats` and `/top`.',
        flags: MessageFlags.Ephemeral
      });
    }

    const sessions = [...service.sessions.values()];
    const gameLines = sessions.length
      ? sessions.map((session) => `**${session.game.kind}** · ${session.phase} · ${session.game.size} players`).join('\n')
      : 'no games running';

    return interaction.reply({
      ...toPayload({
        color: 0x8d99ae,
        title: 'runtime',
        description: `${sessions.length} live session${sessions.length === 1 ? '' : 's'} · ${service.userGames.size} players locked to a channel`,
        fields: [
          {
            name: 'process',
            value:
              `uptime · ${Math.round(process.uptime())}s\n` +
              `memory · ${mb(process.memoryUsage().heapUsed)} heap\n` +
              `node ${process.version} · discord.js ${discordVersion}`,
            inline: false
          },
          { name: 'store', value: `${store.size} player records\n${store.file}`, inline: false },
          { name: 'games', value: gameLines, inline: false }
        ],
        footer: 'owner only · no player data beyond counts',
        rows: []
      }),
      flags: MessageFlags.Ephemeral
    });
  }
};
