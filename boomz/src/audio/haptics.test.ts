import { describe, expect, it } from 'vitest';
import { createMatch } from '../game/match';
import { hapticFor, nearestNewFlame } from './haptics';

describe('vibrations', () => {
  it('font vibrer fort à sa propre élimination, plus qu’une explosion lointaine', () => {
    expect(hapticFor([{ kind: 'death', mine: true }, { kind: 'explosion', count: 1 }], 1)).toEqual({ kind: 'notify', type: 'error' });
    expect(hapticFor([{ kind: 'death', mine: false }], Infinity)).toBeNull();
    expect(hapticFor([{ kind: 'explosion', count: 1 }], 10)).toBeNull();
    expect(hapticFor([{ kind: 'explosion', count: 1 }], 1)).toMatchObject({ style: 'heavy' });
    expect(hapticFor([{ kind: 'explosion', count: 1 }], 2.5)).toMatchObject({ style: 'medium' });
    expect(hapticFor([{ kind: 'bombPlaced', mine: false }], Infinity)).toBeNull();
  });

  it('mesurent la distance aux seules flammes nouvelles', () => {
    const before = createMatch(2, 1, 'chantier');
    const after = structuredClone(before);
    const me = after.round.players[0];
    const width = after.round.width;
    const cx = Math.floor(me.x) + 2;
    const cy = Math.floor(me.y);
    after.round.flames[cy * width + cx] = 10;
    expect(nearestNewFlame(before, after, 0)).toBeCloseTo(2);
    // Flamme déjà là avant : ce n'est pas une nouvelle explosion.
    expect(nearestNewFlame(after, after, 0)).toBe(Infinity);
    expect(nearestNewFlame(before, after, null)).toBe(Infinity);
  });
});
