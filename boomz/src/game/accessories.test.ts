import { describe, expect, it } from 'vitest';
import { ACCESSORIES, Accessory, accessoryUnlocked, isAccessory } from './accessories';

describe('accessoires', () => {
  it('se débloquent avec les étoiles des défis, du plus simple au plus rare', () => {
    expect(accessoryUnlocked(Accessory.Sunglasses, 0)).toBe(true);
    expect(accessoryUnlocked(Accessory.Moustache, 2)).toBe(false);
    expect(accessoryUnlocked(Accessory.Moustache, 3)).toBe(true);
    expect(accessoryUnlocked(Accessory.Crown, 23)).toBe(false);
    expect(accessoryUnlocked(Accessory.Crown, 36)).toBe(true);
    const thresholds = ACCESSORIES.map((info) => info.stars);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
    // Tous accessibles avec les 36 étoiles des défis.
    expect(Math.max(...thresholds)).toBeLessThanOrEqual(36);
  });

  it('refusent les valeurs inconnues', () => {
    expect(isAccessory(ACCESSORIES.length)).toBe(false);
    expect(isAccessory(-1)).toBe(false);
    expect(accessoryUnlocked(99, 99)).toBe(false);
  });
});
