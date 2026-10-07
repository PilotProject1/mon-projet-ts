import { describe, expect, it } from 'vitest';
import { afterMatch, parseMemory } from './review';

const DAY = 24 * 3600 * 1000;

describe('demande de note', () => {
  it('attend quelques matchs et deux victoires, puis demande juste après une victoire', () => {
    let memory = parseMemory(null);
    const steps: boolean[] = [];
    for (const won of [true, false, false, true]) {
      const result = afterMatch(memory, won, 100 * DAY);
      memory = result.memory;
      steps.push(result.ask);
    }
    expect(steps).toEqual([false, false, false, true]);
    expect(memory).toEqual({ matches: 4, wins: 2, askedAt: 100 * DAY });
  });

  it('jamais après une défaite, et pas plus d’une fois par mois', () => {
    const memory = { matches: 10, wins: 5, askedAt: 100 * DAY };
    expect(afterMatch(memory, false, 200 * DAY).ask).toBe(false);
    expect(afterMatch(memory, true, 110 * DAY).ask).toBe(false);
    expect(afterMatch(memory, true, 131 * DAY).ask).toBe(true);
  });

  it('ignore une mémoire illisible', () => {
    expect(parseMemory('{oups')).toEqual({ matches: 0, wins: 0, askedAt: 0 });
    expect(parseMemory('{"matches":-3,"wins":"x"}')).toEqual({ matches: 0, wins: 0, askedAt: 0 });
  });
});
