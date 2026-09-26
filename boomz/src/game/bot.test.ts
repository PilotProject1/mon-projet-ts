import { describe, expect, it } from 'vitest';
import { BotBrain, BOT_LEVELS } from './bot';
import { TICK_RATE } from './constants';
import { createMatch, stepMatch } from './match';
import { createRng } from './rng';

describe('robots', () => {
  for (const level of BOT_LEVELS) {
    it(`${level} : casse des caisses sans se faire sauter`, () => {
      for (const seed of [1, 2, 3]) {
        const match = createMatch(2, seed, 'chantier');
        const brain = new BotBrain(level, createRng(seed));
        while (match.phase !== 'playing') stepMatch(match, []);
        let crates = 0;
        // L'adversaire ne bouge pas : seul le robot peut se blesser.
        for (let tick = 0; tick < 25 * TICK_RATE && match.phase === 'playing'; tick++) {
          const events = stepMatch(match, [brain.decide(match.round, 0), { direction: null, bomb: false }]);
          crates += events.filter((event) => event.type === 'blockDestroyed').length;
          const died = events.find((event) => event.type === 'playerDied' && event.player === 0);
          expect(died, `graine ${seed}`).toBeUndefined();
        }
        expect(crates, `graine ${seed}`).toBeGreaterThan(0);
      }
    });
  }
});
