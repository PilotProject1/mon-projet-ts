import { describe, expect, it } from 'vitest';
import { suddenDeathOrder } from './arena';
import { BOMB_FUSE_TICKS, FLAME_TICKS, GRID_HEIGHT, GRID_WIDTH, SUDDEN_DEATH_TICKS } from './constants';
import { createMatch, stepMatch } from './match';
import { bombAt, cellOf, createRound, stepRound } from './round';
import { NO_INPUT, Tile, type Direction, type PlayerInput, type RoundState } from './types';

function clearArena(state: RoundState): void {
  state.tiles = state.tiles.map((tile) => (tile === Tile.Wall ? Tile.Wall : Tile.Floor));
}

function setTile(state: RoundState, x: number, y: number, tile: Tile): void {
  state.tiles[y * state.width + x] = tile;
}

function run(state: RoundState, ticks: number, inputs: PlayerInput[] = []): void {
  for (let i = 0; i < ticks; i++) stepRound(state, inputs);
}

const walk = (direction: Direction): PlayerInput => ({ direction, bomb: false });
const BOMB: PlayerInput = { direction: null, bomb: true };

describe('arène', () => {
  it('place des murs en damier, garde les départs libres et reste déterministe', () => {
    const a = createRound(2, 42);
    const b = createRound(2, 42);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.tiles).toHaveLength(GRID_WIDTH * GRID_HEIGHT);
    expect(a.tiles[2 * GRID_WIDTH + 2]).toBe(Tile.Wall);
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [11, 9], [10, 9], [11, 8]]) {
      expect(a.tiles[y * GRID_WIDTH + x]).toBe(Tile.Floor);
    }
    expect(a.tiles.filter((tile) => tile === Tile.Block).length).toBeGreaterThan(30);
  });

  it('couvre toutes les cases intérieures libres pendant le resserrement', () => {
    const order = suddenDeathOrder(GRID_WIDTH, GRID_HEIGHT);
    expect(new Set(order).size).toBe(order.length);
    // 11 x 9 cases intérieures, dont 5 x 4 piliers.
    expect(order).toHaveLength(11 * 9 - 5 * 4);
    expect(order[0]).toBe(1 * GRID_WIDTH + 1);
  });
});

describe('déplacements', () => {
  it('avance dans un couloir et s’arrête au centre de la dernière case libre', () => {
    const state = createRound(2, 1);
    clearArena(state);
    run(state, 200, [walk('right')]);
    expect(state.players[0].x).toBeCloseTo(GRID_WIDTH - 1.5);
    expect(state.players[0].y).toBeCloseTo(1.5);
  });

  it('ne traverse pas un bloc destructible', () => {
    const state = createRound(2, 1);
    clearArena(state);
    setTile(state, 3, 1, Tile.Block);
    run(state, 100, [walk('right')]);
    expect(state.players[0].x).toBeCloseTo(2.5);
  });

  it('glisse dans le couloir voisin quand il est assez décalé', () => {
    const state = createRound(2, 1);
    clearArena(state);
    const player = state.players[0];
    // Colonne 1, légèrement au-dessus du centre de la ligne 3 : la case (2,2) est un pilier.
    player.x = 1.5;
    player.y = 2.85;
    run(state, 30, [walk('right')]);
    expect(player.y).toBeCloseTo(3.5);
    expect(player.x).toBeGreaterThan(1.9);
  });
});

describe('bombes', () => {
  it('explose après le délai en croix, détruit le premier bloc et élimine', () => {
    const state = createRound(2, 1);
    clearArena(state);
    setTile(state, 3, 1, Tile.Block);
    setTile(state, 4, 1, Tile.Block);
    stepRound(state, [BOMB]);
    expect(bombAt(state, 1, 1)).toBeDefined();
    run(state, BOMB_FUSE_TICKS - 2);
    expect(state.bombs).toHaveLength(1);
    const events = stepRound(state, []);
    expect(events.map((event) => event.type)).toContain('explosion');
    expect(state.tiles[1 * GRID_WIDTH + 3]).toBe(Tile.Burning);
    expect(state.tiles[1 * GRID_WIDTH + 4]).toBe(Tile.Block);
    expect(state.flames[2 * GRID_WIDTH + 1]).toBeGreaterThan(0);
    expect(state.players[0].alive).toBe(false);
    run(state, FLAME_TICKS);
    expect(state.tiles[1 * GRID_WIDTH + 3]).toBe(Tile.Floor);
    expect(state.flames.every((flame) => flame === 0)).toBe(true);
  });

  it('laisse sortir le poseur de sa bombe mais l’empêche d’y revenir', () => {
    const state = createRound(2, 1);
    clearArena(state);
    stepRound(state, [BOMB]);
    run(state, 18, [walk('right')]);
    const player = state.players[0];
    expect(cellOf(player)).toEqual([2, 1]);
    run(state, 30, [walk('left')]);
    expect(cellOf(player)).toEqual([2, 1]);
    expect(player.x).toBeCloseTo(2.5);
  });

  it('limite le nombre de bombes simultanées', () => {
    const state = createRound(2, 1);
    clearArena(state);
    stepRound(state, [BOMB]);
    run(state, 20, [walk('right')]);
    stepRound(state, [BOMB]);
    expect(state.bombs).toHaveLength(1);
  });

  it('déclenche les bombes voisines en chaîne', () => {
    const state = createRound(2, 1);
    clearArena(state);
    stepRound(state, [BOMB]);
    run(state, 20, [walk('right')]);
    state.players[0].maxBombs = 2;
    stepRound(state, [BOMB]);
    expect(state.bombs).toHaveLength(2);
    run(state, 200, [walk('right')]);
    // La seconde bombe, posée plus tard, explose en même temps que la première.
    expect(state.bombs).toHaveLength(0);
    expect(state.players[0].alive).toBe(true);
  });

  it('arrête la flamme sur un mur indestructible', () => {
    const state = createRound(2, 1);
    clearArena(state);
    state.players[0].x = 1.5;
    state.players[0].y = 3.5;
    state.players[0].range = 5;
    stepRound(state, [BOMB]);
    run(state, BOMB_FUSE_TICKS);
    // Colonne 1, les flammes montent jusqu'à la bordure mais ne la franchissent pas.
    expect(state.flames[0 * GRID_WIDTH + 1]).toBe(0);
    expect(state.flames[1 * GRID_WIDTH + 1]).toBeGreaterThan(0);
  });
});

describe('manche et match', () => {
  it('donne la manche au dernier survivant et le match au premier à 3', () => {
    const match = createMatch(2, 7);
    let guard = 0;
    while (match.phase !== 'matchOver' && guard++ < 100_000) {
      if (match.phase === 'playing') {
        // Le joueur 2 se sacrifie sur place à chaque manche.
        match.round.players[0].x = 1.5;
        match.round.players[0].y = 1.5;
        stepMatch(match, [NO_INPUT, { direction: null, bomb: match.round.bombs.length === 0 }]);
      } else {
        stepMatch(match, []);
      }
    }
    expect(match.phase).toBe('matchOver');
    expect(match.scores).toEqual([3, 0]);
    expect(match.matchWinner).toBe(0);
    expect(match.roundNumber).toBe(3);
  });

  it('referme l’arène et élimine les joueurs pris par le mur', () => {
    const state = createRound(2, 3);
    run(state, SUDDEN_DEATH_TICKS);
    expect(state.tiles[1 * GRID_WIDTH + 1]).toBe(Tile.Wall);
    expect(state.players[0].alive).toBe(false);
    expect(state.players[1].alive).toBe(true);
  });
});
