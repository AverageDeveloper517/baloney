import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';

const STYLES = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger
};

// Discord's hard limits. The games are written to fit, but a long username or a
// creative lie should never turn into a rejected edit.
const LIMITS = { title: 256, description: 4_000, fieldName: 256, fieldValue: 1_024, footer: 2_048, label: 80, id: 100 };

const cut = (value, max) => {
  const text = String(value ?? '');
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
};

/**
 * Turn a game's view model into a Discord payload. One game is one message that
 * gets edited in place, so a whole night of play never spams the channel.
 */
export function toPayload(view, { invite = null } = {}) {
  const embed = new EmbedBuilder().setColor(view.color ?? 0x5865f2).setTitle(cut(view.title ?? 'baloney', LIMITS.title));

  if (view.description) embed.setDescription(cut(view.description, LIMITS.description));
  if (view.fields?.length) {
    embed.addFields(
      view.fields.slice(0, 5).map((field) => ({
        name: cut(field.name, LIMITS.fieldName),
        value: cut(field.value || '—', LIMITS.fieldValue),
        inline: Boolean(field.inline)
      }))
    );
  }
  if (view.footer) embed.setFooter({ text: cut(view.footer, LIMITS.footer) });

  const components = [];
  for (const row of view.rows ?? []) {
    if (!row?.length) continue;
    components.push(
      new ActionRowBuilder().addComponents(
        row.slice(0, 5).map((button) => {
          if (button.url) {
            return new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel(cut(button.label, LIMITS.label))
              .setURL(button.url);
          }
          const built = new ButtonBuilder()
            .setCustomId(cut(button.id, LIMITS.id))
            .setStyle(STYLES[button.style] ?? ButtonStyle.Secondary)
            .setLabel(cut(button.label, LIMITS.label));
          if (button.disabled) built.setDisabled(true);
          return built;
        })
      )
    );
  }

  if (view.invite && invite) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Add Baloney to your server').setURL(invite)
      )
    );
  }

  return {
    embeds: [embed],
    components,
    // Player-written lies are never allowed to ping anyone.
    allowedMentions: { parse: [] }
  };
}
