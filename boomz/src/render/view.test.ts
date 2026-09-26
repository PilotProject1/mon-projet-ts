import { describe, expect, it } from 'vitest';
import { createRound, stepRound } from '../game/round';
import { DIRECTION_VECTORS, Feature, type Direction } from '../game/types';
import { screenToGrid, toScreenRound } from './view';

describe('vue pivotée (portrait)', () => {
  it('fait tourner l’arène d’un quart de tour sans rien perdre', () => {
    const round = createRound(2, 4, 'station');
    const view = toScreenRound(round, true);
    expect([view.width, view.height]).toEqual([round.height, round.width]);
    expect([...view.tiles].sort()).toEqual([...round.tiles].sort());
    // Case (x, y) → colonne height-1-y, ligne x.
    const x = 3;
    const y = 1;
    expect(view.tiles[x * view.width + (round.height - 1 - y)]).toBe(round.tiles[y * round.width + x]);
    // Le joueur 1, en (1,1), se retrouve en haut à droite.
    expect([view.players[0].x, view.players[0].y]).toEqual([round.height - 1.5, 1.5]);
  });

  it('tourne aussi le sens des tapis roulants', () => {
    const round = createRound(2, 4, 'station');
    const view = toScreenRound(round, true);
    const index = 3 * round.width + 5; // tapis vers la droite, ligne 3
    expect(round.features[index]).toBe(Feature.ConveyorRight);
    const screenIndex = 5 * view.width + (round.height - 1 - 3);
    expect(view.features[screenIndex]).toBe(Feature.ConveyorDown);
  });

  it('fait correspondre le joystick à ce que le joueur voit', () => {
    // Pousser vers le haut de l'écran doit faire monter le personnage à l'écran.
    for (const screen of ['up', 'down', 'left', 'right'] as Direction[]) {
      const round = createRound(2, 4);
      round.tiles = round.tiles.map((tile) => (tile === 1 ? 1 : 0));
      round.players[0].x = 5.5;
      round.players[0].y = 5.5;
      const before = toScreenRound(round, true).players[0];
      for (let i = 0; i < 10; i++) stepRound(round, [{ direction: screenToGrid(screen, true), bomb: false }]);
      const after = toScreenRound(round, true).players[0];
      const [dx, dy] = DIRECTION_VECTORS[screen];
      expect(Math.sign(Math.round((after.x - before.x) * 100))).toBe(dx);
      expect(Math.sign(Math.round((after.y - before.y) * 100))).toBe(dy);
    }
  });

  it('ne change rien quand l’écran est en paysage', () => {
    const round = createRound(2, 4);
    expect(toScreenRound(round, false)).toBe(round);
    expect(screenToGrid('up', false)).toBe('up');
  });
});
