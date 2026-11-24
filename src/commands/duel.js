import { gameCommand } from '../game-command.js';

export default gameCommand('duel', {
  withRounds: false,
  description: 'two players, rock paper scissors, first to two rounds'
});
