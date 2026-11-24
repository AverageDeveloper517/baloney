import { BluffGame } from './bluff.js';
import { MostLikelyGame } from './mostlikely.js';
import { TriviaGame } from './trivia.js';
import { WyrGame } from './wyr.js';
import { NumberGame } from './number.js';
import { DuelGame } from './duel.js';
import { ChainGame } from './chain.js';
import { ImpostorGame } from './impostor.js';
import { ScatterGame } from './scatter.js';

import { PROMPTS, promptsForPack, PACK_NAMES } from '../content/prompts.js';
import { SITUATIONS } from '../content/situations.js';
import { TRIVIA } from '../content/trivia.js';
import { WYR } from '../content/wyr.js';
import { IMPOSTOR } from '../content/impostor.js';
import { SCATTER_CATEGORIES, SCATTER_LETTERS } from '../content/scatter.js';
import { CHAIN_OPENERS } from '../content/chain.js';

/**
 * The single registry every command, the party runner and the help card read
 * from. Adding a game means adding one entry here and one command file.
 */
export const GAME_DEFS = {
  bluff: {
    label: 'Bluff',
    ns: 'bl',
    min: 3,
    max: 10,
    rounds: 3,
    maxRounds: 5,
    blurb: 'write a lie, find the truth',
    create: ({ pack, ...args }) => new BluffGame({ prompts: promptsForPack(pack), ...args })
  },
  mostlikely: {
    label: 'Most Likely To',
    ns: 'ml',
    min: 3,
    max: 10,
    rounds: 3,
    maxRounds: 5,
    blurb: 'no typing, one tap per round',
    create: (args) => new MostLikelyGame({ situations: SITUATIONS, ...args })
  },
  trivia: {
    label: 'Trivia',
    ns: 'tr',
    min: 2,
    max: 12,
    rounds: 5,
    maxRounds: 8,
    blurb: 'five questions, four buttons',
    create: (args) => new TriviaGame({ questions: TRIVIA, ...args })
  },
  wyr: {
    label: 'Would You Rather',
    ns: 'wr',
    min: 2,
    max: 12,
    rounds: 4,
    maxRounds: 6,
    blurb: 'two buttons, one majority',
    create: (args) => new WyrGame({ prompts: WYR, ...args })
  },
  number: {
    label: 'The Number Game',
    ns: 'nm',
    min: 2,
    max: 12,
    rounds: 3,
    maxRounds: 5,
    blurb: 'guess closest to the secret number',
    create: (args) => new NumberGame(args)
  },
  duel: {
    label: 'Duel',
    ns: 'du',
    min: 2,
    max: 2,
    rounds: 3,
    maxRounds: 3,
    blurb: 'two players, rock paper scissors',
    create: (args) => new DuelGame(args)
  },
  chain: {
    label: 'Chain Story',
    ns: 'ch',
    min: 3,
    max: 10,
    rounds: 2,
    maxRounds: 4,
    blurb: 'one sentence each, vote for the best line',
    create: (args) => new ChainGame({ openers: CHAIN_OPENERS, ...args })
  },
  impostor: {
    label: 'Impostor',
    ns: 'im',
    min: 3,
    max: 10,
    rounds: 2,
    maxRounds: 4,
    blurb: 'one player has a different word',
    create: (args) => new ImpostorGame({ pairs: IMPOSTOR, ...args })
  },
  scatter: {
    label: 'Scatter',
    ns: 'sc',
    min: 2,
    max: 10,
    rounds: 2,
    maxRounds: 4,
    blurb: 'one letter, three categories, sixty seconds',
    create: (args) =>
      new ScatterGame({ categories: SCATTER_CATEGORIES, letters: SCATTER_LETTERS, ...args })
  }
};

export const GAME_KEYS = Object.keys(GAME_DEFS);
export const PLAYABLE = [...GAME_KEYS];
export const PACK_OPTIONS = [...PACK_NAMES, 'all'];

export const BLUFF_PACK_CHOICES = PACK_OPTIONS.map((pack) => ({
  name: pack === 'all' ? 'everything' : pack,
  value: pack
}));

export function gameDef(kind) {
  return GAME_DEFS[kind] ?? null;
}

export function labelOf(kind) {
  return GAME_DEFS[kind]?.label ?? kind;
}

export function createGame(kind, args) {
  const def = GAME_DEFS[kind];
  if (!def) throw new Error(`unknown game: ${kind}`);
  return def.create({
    ns: def.ns,
    label: def.label,
    blurb: def.blurb,
    ...args
  });
}
