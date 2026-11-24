import { SlashCommandBuilder } from 'discord.js';

import { GAME_DEFS, BLUFF_PACK_CHOICES } from './games/index.js';

/**
 * Every playable game shares the same command shape: a name, a one-line
 * description, an optional round count, and (for bluff only) a prompt pack.
 * Building them from the registry keeps the command list and the game list in
 * sync forever.
 */
export function gameCommand(kind, { description, withPack = false, withRounds = true } = {}) {
  const def = GAME_DEFS[kind];
  if (!def) throw new Error(`unknown game: ${kind}`);

  const builder = new SlashCommandBuilder()
    .setName(kind)
    .setDescription(description ?? `${def.blurb} · ${def.min}–${def.max} players`);

  if (withRounds) {
    builder.addIntegerOption((option) =>
      option
        .setName('rounds')
        .setDescription(`how many rounds (default ${def.rounds}, max ${def.maxRounds})`)
        .setMinValue(1)
        .setMaxValue(def.maxRounds)
        .setRequired(false)
    );
  }

  if (withPack) {
    builder.addStringOption((option) =>
      option
        .setName('pack')
        .setDescription('which set of prompts to use')
        .addChoices(...BLUFF_PACK_CHOICES)
        .setRequired(false)
    );
  }

  return {
    data: builder,

    async run({ interaction, service }) {
      const rounds = withRounds ? interaction.options.getInteger('rounds') ?? undefined : undefined;
      const pack = withPack ? interaction.options.getString('pack') ?? undefined : undefined;
      await service.startGame({ interaction, kind, rounds, pack });
    }
  };
}
