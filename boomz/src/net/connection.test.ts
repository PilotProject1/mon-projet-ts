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

  it('écarte un état arrivé après un plus récent, sauf après une reconnexion', () => {
    const first = createMatch(2, 1);
    const second = structuredClone(first);
    second.round.tick = 10;
    const buffer = new SnapshotBuffer();
    buffer.push(second, 1000, 5);
    buffer.push(first, 1010, 4);
    expect(buffer.latest()?.round.tick).toBe(10);
    buffer.restartSequence();
    buffer.push(first, 1020, 1);
    expect(buffer.latest()?.round.tick).toBe(0);
  });

  it('allonge le retard d’affichage quand les états arrivent irrégulièrement, puis le résorbe', () => {
    const match = createMatch(2, 1);
    const buffer = new SnapshotBuffer();
    let at = 0;
    for (let i = 0; i < 5; i++) buffer.push(match, (at += 50));
    expect(buffer.delay).toBe(100);
    buffer.push(match, (at += 180));
    expect(buffer.delay).toBeGreaterThan(200);
    expect(buffer.delay).toBeLessThanOrEqual(260);
    for (let i = 0; i < 200; i++) buffer.push(match, (at += 50));
    expect(buffer.delay).toBeLessThan(105);
  });
});
