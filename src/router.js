import { MessageFlags } from 'discord.js';

/**
 * One entry point for commands, buttons and modals. Every path is wrapped so a
 * single bad interaction can never take the process down, and an interaction
 * that Discord delivers twice (reconnects do this) is only handled once.
 */
export function createRouter({ client, service, store, invite, log }) {
  const seen = new Map(); // interaction id -> expiry
  const TTL = 60_000;

  function duplicate(id) {
    const now = Date.now();
    for (const [key, expires] of seen) {
      if (expires <= now) seen.delete(key);
    }

    if (seen.has(id)) return true;
    seen.set(id, now + TTL);
    return false;
  }

  async function fail(interaction, err) {
    log.error(`interaction ${interaction.commandName ?? interaction.customId ?? interaction.id}: ${err.stack ?? err.message}`);

    const payload = { content: 'something broke on my end. try that again.', flags: MessageFlags.Ephemeral };
    try {
      if (!interaction.isRepliable()) return;
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch {
      // Nothing else to do; the interaction is gone.
    }
  }

  return async function onInteraction(interaction) {
    try {
      if (interaction.id && duplicate(interaction.id)) {
        log.info(`ignoring duplicate interaction ${interaction.id}`);
        return;
      }

      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.run({ interaction, service, store, invite, log });
        return;
      }

      if (interaction.isButton()) {
        await service.handleButton(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        await service.handleModal(interaction);
      }
    } catch (err) {
      await fail(interaction, err);
    }
  };
}
