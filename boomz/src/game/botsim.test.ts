import { expect, it } from 'vitest';
import { BotBrain } from './bot';
import { TICK_RATE } from './constants';
import { createMatch, stepMatch } from './match';
import { CHARACTERS } from './powers';
import { createRng } from './rng';

// Matchs entre robots Experts, chacun avec un personnage : tous se servent de
// leur pouvoir (l'équilibre fin se règle avec de vrais joueurs).
it('robots : chaque personnage utilise son pouvoir en partie', { timeout: 60_000 }, () => {
  const uses = new Array<number>(CHARACTERS.length).fill(0);
  for (let seed = 1; seed <= 8; seed++) {
    const cast = [0, 1, 2, 3].map((i) => (seed + i * 2) % CHARACTERS.length);
    const match = createMatch(4, seed, 'rotation', cast, true);
    const rng = createRng(seed);
    const brains = cast.map(() => new BotBrain('expert', rng));
    for (let tick = 0; tick < 90 * TICK_RATE && match.phase !== 'matchOver'; tick++) {
      for (const event of stepMatch(match, brains.map((brain, i) => brain.decide(match.round, i)))) {
        if (event.type === 'powerUsed') uses[match.characters[event.player]]++;
      }
    }
  }
  CHARACTERS.forEach((character, i) => expect(uses[i], character.name).toBeGreaterThan(0));
});
