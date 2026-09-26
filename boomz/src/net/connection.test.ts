import { describe, expect, it } from 'vitest';
import { createMatch } from '../game/match';
import { SnapshotBuffer } from './connection';

describe('interpolation des états reçus', () => {
  it('fait glisser une bombe poussée entre deux états, sans à-coup', () => {
    const before = createMatch(2, 1);
    const after = structuredClone(before);
    before.round.bombs = [{ id: 1, owner: 0, cx: 2, cy: 1, fuse: 99, range: 2, passThrough: [], remote: false, slide: 'right', slideProgress: 0.5 }];
    after.round.bombs = [{ ...before.round.bombs[0], cx: 3, slideProgress: 0.2 }];
    const buffer = new SnapshotBuffer();
    buffer.push(before, 1000);
    buffer.push(after, 1050);
    // L'affichage a 100 ms de retard : l'instant 1125 correspond au milieu des deux états.
    const bomb = buffer.sample(1125)?.round.bombs[0];
    expect(bomb?.cx).toBe(3);
    expect(bomb && bomb.cx + (bomb.slideProgress ?? 0)).toBeCloseTo(2.85);
  });

  it('interpole les personnages mais pas d’une manche à l’autre', () => {
    const before = createMatch(2, 1);
    const after = structuredClone(before);
    after.round.players[0].x = 2.5;
    const buffer = new SnapshotBuffer();
    buffer.push(before, 1000);
    buffer.push(after, 1050);
    expect(buffer.sample(1125)?.round.players[0].x).toBeCloseTo(2);
    after.roundNumber = 2;
    const next = new SnapshotBuffer();
    next.push(before, 1000);
    next.push(after, 1050);
    expect(next.sample(1125)?.round.players[0].x).toBeCloseTo(2.5);
  });
});
