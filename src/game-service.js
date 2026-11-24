import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

import { BluffGame } from './games/bluff.js';
import { MostLikelyGame } from './games/mostlikely.js';
import { Session } from './session.js';
import { toPayload } from './ui.js';
import { PROMPTS } from './content/prompts.js';
import { SITUATIONS } from './content/situations.js';
import { log as defaultLog } from './log.js';

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });

const GAMES = {
  bluff: {
    ns: 'bl',
    create: (args) => new BluffGame({ prompts: PROMPTS, ...args })
  },
  mostlikely: {
    ns: 'ml',
    create: (args) => new MostLikelyGame({ situations: SITUATIONS, ...args })
  }
};

/**
 * Owns every live game. Games are per channel and in memory; the only durable
 * state is the stats file. That keeps the bot honest and the setup trivial.
 */
export function createGameService({
  store,
  invite = null,
  log = defaultLog.info,
  clock = Date.now,
  timers
}) {
  const sessions = new Map(); // channelId -> Session
  const userGames = new Map(); // userId -> channelId

  const say = (interaction, content) =>
    interaction.reply(ephemeral(content)).catch(() => {});

  const nameOf = (interaction) =>
    interaction.member?.displayName ??
    interaction.user.globalName ??
    interaction.user.username ??
    'player';

  function inOtherChannel(userId, channelId) {
    const current = userGames.get(userId);
    return current && current !== channelId ? current : null;
  }

  async function startGame({ interaction, kind, rounds }) {
    const meta = GAMES[kind];
    if (!meta) throw new Error(`unknown game: ${kind}`);

    const channelId = interaction.channelId;
    const existing = sessions.get(channelId);
    if (existing && !existing.ended) {
      return say(interaction, 'a game is already running in this channel. finish it, or start one somewhere else.');
    }

    const other = inOtherChannel(interaction.user.id, channelId);
    if (other) return say(interaction, `you are already in a game in <#${other}>. one game at a time.`);

    const game = meta.create({
      channelId,
      guildId: interaction.guildId ?? null,
      hostId: interaction.user.id,
      rounds,
      clock
    });

    game.add({ id: interaction.user.id, name: nameOf(interaction) });
    userGames.set(interaction.user.id, channelId);

    let message;
    try {
      const response = await interaction.reply({
        ...toPayload(game.view(), { invite }),
        withResponse: true
      });
      message = response.resource?.message ?? (await interaction.fetchReply());
    } catch (err) {
      // The post failed (no permission, expired interaction). Roll the lock back
      // so the player is not stuck "already in a game" that never existed.
      if (userGames.get(interaction.user.id) === channelId) userGames.delete(interaction.user.id);
      throw err;
    }

    const session = new Session({
      game,
      invite,
      now: clock,
      timers,
      log: (msg) => log(`[${kind}/${game.id}] ${msg}`),
      update: (payload) => message.edit(payload),
      onEnd: async (finished, reason) => {
        if (sessions.get(channelId) === session) sessions.delete(channelId);
        for (const player of finished.players) {
          if (userGames.get(player.id) === channelId) userGames.delete(player.id);
        }

        // Only completed games count. A lobby that timed out is not a loss.
        if (reason !== 'done') return;

        const standings = finished.standings();
        const top = standings[0]?.score ?? 0;
        const winnerIds = top > 0 ? standings.filter((p) => p.score === top).map((p) => p.id) : [];

        try {
          await store.record({
            guildId: finished.guildId,
            players: finished.players,
            winnerIds,
            rounds: finished.round
          });
        } catch (err) {
          log(`could not save stats: ${err.message}`);
        }
      }
    });

    sessions.set(channelId, session);

    session.arm();
    log(`started ${kind} ${game.id} in ${channelId} by ${nameOf(interaction)}`);
    return session;
  }

  async function onJoin(interaction, session) {
    const game = session.game;
    if (game.phase !== 'lobby') {
      return say(interaction, 'the game already started. catch the next one — they run often.');
    }

    const other = inOtherChannel(interaction.user.id, interaction.channelId);
    if (other) return say(interaction, `you are already in a game in <#${other}>.`);

    const result = game.add({ id: interaction.user.id, name: nameOf(interaction) });
    if (!result.ok) {
      const reasons = {
        full: 'this lobby is full. ten is the limit.',
        already: 'you are already in. press Start when everyone is ready.',
        started: 'the game already started.'
      };
      return say(interaction, reasons[result.reason] ?? 'could not join.');
    }

    userGames.set(interaction.user.id, interaction.channelId);
    await say(interaction, `you're in · ${result.count}/${game.maxPlayers}`);

    if (game.full) {
      game.start();
      await session.refresh();
      return;
    }

    await session.refresh();
  }

  async function onLeave(interaction, session) {
    const game = session.game;
    if (game.phase !== 'lobby') {
      return say(interaction, 'the game is running. leaving now would not change the score.');
    }

    game.remove(interaction.user.id);
    if (userGames.get(interaction.user.id) === interaction.channelId) userGames.delete(interaction.user.id);

    await say(interaction, 'you left the lobby.');
    if (!game.size) game.cancel();
    await session.refresh();
  }

  async function onStart(interaction, session) {
    const game = session.game;
    if (game.hostId !== interaction.user.id) {
      return say(interaction, 'only the host can start. the host is the one who ran the command.');
    }
    if (game.phase !== 'lobby') return say(interaction, 'this game is already running.');

    const result = game.start();
    if (!result.ok) {
      return say(interaction, result.reason === 'few' ? `you need at least ${game.minPlayers} players.` : 'cannot start yet.');
    }

    await interaction.deferUpdate().catch(() => {});
    await session.refresh();
  }

  async function onCancel(interaction, session) {
    if (session.game.hostId !== interaction.user.id) {
      return say(interaction, 'only the host can cancel.');
    }
    session.game.cancel();
    await interaction.deferUpdate().catch(() => {});
    await session.refresh();
  }

  async function onWrite(interaction, session) {
    const game = session.game;
    if (game.kind !== 'bluff' || !game.prompt) {
      return say(interaction, 'this game does not take written answers. just vote.');
    }
    if (game.phase !== 'submit') return say(interaction, 'writing is closed for this round.');

    const player = game.get(interaction.user.id);
    if (!player) return say(interaction, 'you are watching this one. run `/bluff` to host your own.');
    if (game.submissions.has(interaction.user.id)) return say(interaction, 'your answer is already in. sit tight.');

    const modal = new ModalBuilder().setCustomId(`blm:${game.id}`).setTitle('your lie');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('lie')
          .setLabel(`Fill the blank: ${String(game.prompt.prompt).replace(/_{2,}/g, '____')}`.slice(0, 45))
          .setPlaceholder('make it sound true')
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(80)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal).catch((err) => log(`modal failed: ${err.message}`));
  }

  async function onVote(interaction, session, key) {
    const game = session.game;

    if (game.kind === 'bluff') {
      const result = game.vote(interaction.user.id, key);
      if (!result.ok) {
        const reasons = {
          own: 'that one is your lie. pick another.',
          voted: 'one vote each. it is locked in.',
          truth: 'you wrote the real answer, so you sit this vote out.',
          phase: 'voting is closed.',
          player: 'you are watching this one.',
          missing: 'that option is gone.'
        };
        return say(interaction, reasons[result.reason] ?? 'could not record that vote.');
      }
      await say(interaction, `vote locked · ${key}`);
    } else {
      const result = game.vote(interaction.user.id, key);
      if (!result.ok) {
        const reasons = {
          self: 'you cannot vote for yourself. tempting, though.',
          voted: 'one vote each. it is locked in.',
          phase: 'voting is closed.',
          player: 'you are watching this one.',
          target: 'that player is not in the game.'
        };
        return say(interaction, reasons[result.reason] ?? 'could not record that vote.');
      }
      const target = game.get(key);
      await say(interaction, `vote locked · ${target?.name ?? 'player'}`);
    }

    await session.refresh();
  }

  async function handleButton(interaction) {
    const [ns, id, action, key] = interaction.customId.split(':');
    const session = sessions.get(interaction.channelId);

    if (!session || session.ended || session.id !== id) {
      return say(interaction, 'that game has ended. `/bluff` or `/mostlikely` starts a new one.');
    }

    if (session.game.kind === 'bluff' && ns !== 'bl') return say(interaction, 'wrong game for that button.');
    if (session.game.kind === 'mostlikely' && ns !== 'ml') return say(interaction, 'wrong game for that button.');

    switch (action) {
      case 'join':
        return onJoin(interaction, session);
      case 'leave':
        return onLeave(interaction, session);
      case 'start':
        return onStart(interaction, session);
      case 'cancel':
        return onCancel(interaction, session);
      case 'write':
        return onWrite(interaction, session);
      case 'v':
        return onVote(interaction, session, key);
      default:
        return say(interaction, 'that button is from an older game.');
    }
  }

  async function handleModal(interaction) {
    const [ns, id] = interaction.customId.split(':');
    if (ns !== 'blm') return;

    const session = sessions.get(interaction.channelId);
    if (!session || session.ended || session.id !== id || session.game.kind !== 'bluff') {
      return say(interaction, 'that round has ended. nothing was submitted.');
    }

    const text = interaction.fields.getTextInputValue('lie');
    const result = session.game.submit(interaction.user.id, text);

    if (!result.ok) {
      const reasons = {
        phase: 'the round moved on. your answer did not count.',
        player: 'you are watching this one.',
        already: 'your answer is already in.',
        short: 'give it at least two characters.',
        long: '80 characters is the ceiling. be concise, liar.'
      };
      return say(interaction, reasons[result.reason] ?? 'could not save that.');
    }

    if (result.truth) {
      await say(interaction, "that's the real answer. you sit this vote out — you already know it.");
    } else if (result.merged) {
      await say(interaction, `someone wrote the same thing. you're sharing **${result.text}**.`);
    } else {
      const total = session.game.active().length;
      await say(interaction, `locked in · ${session.game.submittedCount()}/${total}`);
    }

    await session.refresh();
  }

  function activeIn(channelId) {
    const session = sessions.get(channelId);
    return session && !session.ended ? session : null;
  }

  /** Safety net for games whose message vanished without an error reaching us. */
  function sweep(maxAgeMs = 3 * 60 * 60_000) {
    const now = clock();
    for (const [channelId, session] of sessions) {
      if (session.ended) {
        sessions.delete(channelId);
        continue;
      }
      if (now - session.game.createdAt > maxAgeMs) {
        session.finish('swept').catch(() => {});
        sessions.delete(channelId);
      }
    }
  }

  return {
    sessions,
    userGames,
    startGame,
    handleButton,
    handleModal,
    activeIn,
    sweep,
    close: async () => {
      for (const session of sessions.values()) await session.finish('shutdown');
      sessions.clear();
      userGames.clear();
    }
  };
}
