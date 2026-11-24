import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

import { GAME_DEFS, createGame, labelOf } from './games/index.js';
import { PACE, clamp } from './games/base.js';
import { PartyRun, PARTY_PLAYLISTS } from './party.js';
import { Session } from './session.js';
import { toPayload } from './ui.js';
import { settleGame, settleParty } from './meta.js';
import { log as defaultLog } from './log.js';

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });

const REASONS = {
  phase: 'that window has closed.',
  player: 'you are watching this one.',
  already: 'your answer is already in.',
  short: 'that is a bit too short.',
  long: 'that is over the limit. be concise.',
  range: 'pick a whole number from 1 to 100.',
  word: 'that is literally your word. try a clue.',
  voted: 'one vote each. it is locked in.',
  own: 'that one is yours. pick another.',
  truth: 'you wrote the real answer, so you sit this vote out.',
  missing: 'that option is gone.',
  self: 'you cannot pick yourself. tempting, though.',
  target: 'that player is not in the game.'
};

const REASON_FALLBACK = 'that did not go through. try again.';

export function createGameService({
  store,
  invite = null,
  log = defaultLog.info,
  clock = Date.now,
  timers
}) {
  const sessions = new Map(); // channelId -> Session
  const userGames = new Map(); // userId -> channelId

  const say = (interaction, content) => interaction.reply(ephemeral(content)).catch(() => {});

  const nameOf = (interaction) =>
    interaction.member?.displayName ??
    interaction.user.globalName ??
    interaction.user.username ??
    'player';

  function inOtherChannel(userId, channelId) {
    const current = userGames.get(userId);
    return current && current !== channelId ? current : null;
  }

  function paceFor(guildId) {
    const settings = store.guildSettings(guildId);
    return { settings, pace: PACE[settings.pace] ?? 1 };
  }

  function defaultRounds(def, requested, settings) {
    const wanted = requested ?? settings.rounds ?? def.rounds;
    return clamp(Number(wanted) || def.rounds, 1, def.maxRounds ?? 5);
  }

  function buildParty({ interaction, channelId, guildId, hostId, pace, rounds, playlistKey }) {
    const chosen = PARTY_PLAYLISTS[playlistKey] ?? PARTY_PLAYLISTS.classic;
    const playlist = [...chosen.games];
    const labels = playlist.map((kind) => labelOf(kind));

    const makeGame = (kind) => {
      const def = GAME_DEFS[kind];
      return createGame(kind, {
        channelId,
        guildId,
        hostId,
        clock,
        pace,
        rounds: defaultRounds(def, rounds, store.guildSettings(guildId))
      });
    };

    return new PartyRun({
      playlist,
      labels,
      rounds,
      channelId,
      guildId,
      hostId,
      clock,
      pace,
      makeGame
    });
  }

  async function startGame({ interaction, kind, rounds, pack, playlist }) {
    if (kind !== 'party' && !GAME_DEFS[kind]) throw new Error(`unknown game: ${kind}`);

    const channelId = interaction.channelId;
    const guildId = interaction.guildId ?? null;
    const hostId = interaction.user.id;

    const existing = sessions.get(channelId);
    if (existing && !existing.ended) {
      return say(interaction, 'a game is already running in this channel. finish it, or start one somewhere else.');
    }

    const other = inOtherChannel(hostId, channelId);
    if (other) return say(interaction, `you are already in a game in <#${other}>. one game at a time.`);

    const { settings, pace } = paceFor(guildId);
    let game;
    let party = null;

    if (kind === 'party') {
      party = buildParty({ interaction, channelId, guildId, hostId, pace, rounds, playlistKey: playlist });
      game = party.lobby();
    } else {
      const def = GAME_DEFS[kind];
      game = createGame(kind, {
        channelId,
        guildId,
        hostId,
        clock,
        pace,
        rounds: defaultRounds(def, rounds, settings),
        pack
      });
    }

    game.add({ id: hostId, name: nameOf(interaction) });
    userGames.set(hostId, channelId);

    let message;
    try {
      const response = await interaction.reply({
        ...toPayload(game.view(), { invite }),
        withResponse: true
      });
      message = response.resource?.message ?? (await interaction.fetchReply());
    } catch (err) {
      // Roll the lock back so a failed post cannot strand the player.
      if (userGames.get(hostId) === channelId) userGames.delete(hostId);
      throw err;
    }

    game.messageId = message.id;

    const session = new Session({
      game,
      invite,
      now: clock,
      timers,
      log: (msg) => log(`[${kind}/${game.id}] ${msg}`),
      update: (payload) => message.edit(payload),
      planNext: party ? (finished, reason) => party.next(finished, reason) : undefined,
      onEnd: async (finished, reason) => {
        if (reason !== 'done') return;

        if (finished.kind === 'party-board') {
          try {
            await settleParty({ store, guildId: finished.guildId, players: finished.roster ?? [] });
          } catch (err) {
            log(`could not settle the party: ${err.message}`);
          }
          return;
        }

        if (finished.kind === 'party' || finished.kind === 'party-break') return;

        const winnerIds = finished.winners();
        const totalRounds = Number.isFinite(finished.round) ? finished.round : finished.rounds ?? 1;

        try {
          await settleGame({
            store,
            guildId: finished.guildId,
            kind: finished.kind,
            players: finished.players,
            winnerIds,
            rounds: totalRounds
          });
        } catch (err) {
          log(`could not save stats: ${err.message}`);
        }
      },
      onClose: async () => {
        if (sessions.get(channelId) === session) sessions.delete(channelId);
        for (const memberId of session.members) {
          if (userGames.get(memberId) === channelId) userGames.delete(memberId);
        }
      }
    });

    session.members = new Set([hostId]);
    sessions.set(channelId, session);

    session.arm();
    log(`started ${kind} ${game.id} in ${channelId} by ${nameOf(interaction)}`);
    return session;
  }

  async function onJoin(interaction, session) {
    const game = session.game;
    if (game.phase !== 'lobby') {
      return say(interaction, 'the game already started. catch the next one.');
    }

    const other = inOtherChannel(interaction.user.id, interaction.channelId);
    if (other) return say(interaction, `you are already in a game in <#${other}>.`);

    const result = game.add({ id: interaction.user.id, name: nameOf(interaction) });
    if (!result.ok) {
      const reasons = {
        full: `this lobby is full. ${game.maxPlayers} is the limit.`,
        already: 'you are already in. press Start when everyone is ready.',
        started: 'the game already started.'
      };
      return say(interaction, reasons[result.reason] ?? 'could not join.');
    }

    session.members.add(interaction.user.id);
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
    session.members.delete(interaction.user.id);
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
    const form = game.writeForm?.();
    if (!form) return say(interaction, 'this game is all buttons. no typing needed.');

    const modal = new ModalBuilder().setCustomId(form.customId).setTitle(form.title.slice(0, 45));

    for (const input of form.inputs.slice(0, 5)) {
      const min = clamp(Number(input.min ?? 1), 0, 4_000);
      const max = clamp(Number(input.max ?? 100), Math.max(1, min), 4_000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(input.id)
            .setLabel(String(input.label).slice(0, 45))
            .setPlaceholder(String(input.placeholder ?? '').slice(0, 100))
            .setStyle(input.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setMinLength(min)
            .setMaxLength(max)
            .setRequired(min > 0)
        )
      );
    }

    await interaction.showModal(modal).catch((err) => log(`modal failed: ${err.message}`));
  }

  function readFields(interaction, form) {
    const values = {};
    for (const input of form.inputs) {
      try {
        values[input.id] = interaction.fields.getTextInputValue(input.id);
      } catch {
        values[input.id] = '';
      }
    }
    return values;
  }

  async function onModal(interaction, session) {
    const game = session.game;
    const form = game.writeForm?.();
    if (!form) return say(interaction, 'that window has closed. nothing was submitted.');

    const values = readFields(interaction, form);
    const result = game.submit(interaction.user.id, values);

    if (!result.ok) return say(interaction, REASONS[result.reason] ?? REASON_FALLBACK);

    if (result.truth) {
      await say(interaction, "that's the real answer. you sit this vote out — you already know it.");
    } else if (result.merged) {
      await say(interaction, `someone wrote the same thing. you're sharing **${result.text}**.`);
    } else if (result.value !== undefined) {
      await say(interaction, `locked in · ${result.value}`);
    } else {
      const total = game.active().length;
      const done = progressOf(game);
      await say(interaction, `locked in · ${done}/${total}`);
    }

    await session.refresh();
  }

  /** How many players have handed something in, whatever the game calls it. */
  function progressOf(game) {
    if (typeof game.submittedCount === 'function') return game.submittedCount();
    for (const key of ['answers', 'guesses', 'clues', 'lines', 'submissions']) {
      if (game[key] instanceof Map) return game[key].size;
    }
    return 0;
  }

  async function onVote(interaction, session, key) {
    const game = session.game;
    const result = game.vote(interaction.user.id, key);

    if (!result.ok) return say(interaction, REASONS[result.reason] ?? REASON_FALLBACK);

    const label = game.voteLabel?.(key) ?? game.get?.(key)?.name ?? String(key).toUpperCase();
    await say(interaction, `vote locked · ${label}`);
    await session.refresh();
  }

  async function onWord(interaction, session) {
    const game = session.game;
    const word = game.secret?.(interaction.user.id);

    if (!word) return say(interaction, 'you are not in this round.');
    if (game.phase === 'lobby') return say(interaction, 'the game has not started yet.');

    game.markSeen?.(interaction.user.id);
    await say(interaction, `your word: **${word}**\n\nkeep it to yourself. write a clue, not the word.`);
    await session.refresh();
  }

  async function handleButton(interaction) {
    const [ns, id, action, key] = interaction.customId.split(':');
    const session = sessions.get(interaction.channelId);

    if (!session || session.ended || session.id !== id) {
      return say(interaction, 'that game has ended. `/help` lists the games.');
    }

    const kind = session.game.kind;
    const def = GAME_DEFS[kind];
    if (kind !== 'party' && def && def.ns !== ns) {
      return say(interaction, 'wrong game for that button.');
    }

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
      case 'word':
        return onWord(interaction, session);
      case 'v':
        return onVote(interaction, session, key);
      default:
        return say(interaction, 'that button is from an older game.');
    }
  }

  async function handleModal(interaction) {
    const [ns, id] = interaction.customId.split(':');
    if (ns !== 'gm') return;

    const session = sessions.get(interaction.channelId);
    if (!session || session.ended || session.id !== id) {
      return say(interaction, 'that round has ended. nothing was submitted.');
    }

    return onModal(interaction, session);
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
    labelOf,
    close: async () => {
      for (const session of sessions.values()) await session.finish('shutdown');
      sessions.clear();
      userGames.clear();
    }
  };
}
