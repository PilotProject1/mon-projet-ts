import { describe, expect, it } from 'vitest';
import { generateArena } from './arena';
import {
  BASE_SPEED,
  BONUS_DURATION_TICKS,
  BOMB_FUSE_TICKS,
  FLAME_TICKS,
  GRID_HEIGHT,
  GRID_WIDTH,
  REMOTE_FUSE_TICKS,
  SPAWNS,
  VEST_GRACE_TICKS,
} from './constants';
import { arenaForRound, createMatch } from './match';
import { applyBonus, bombAt, cellOf, createRound, stepRound } from './round';
import { ARENA_IDS, Bonus, Feature, Tile, type Direction, type PlayerInput, type RoundState } from './types';

const W = GRID_WIDTH;
const at = (x: number, y: number) => y * W + x;

function clearArena(state: RoundState): void {
  state.tiles = state.tiles.map((tile) => (tile === Tile.Wall ? Tile.Wall : Tile.Floor));
  state.hiddenBonuses = state.hiddenBonuses.map(() => Bonus.None);
}

function run(state: RoundState, ticks: number, inputs: PlayerInput[] = []): void {
  for (let i = 0; i < ticks; i++) stepRound(state, inputs);
}

const walk = (direction: Direction): PlayerInput => ({ direction, bomb: false });
const BOMB: PlayerInput = { direction: null, bomb: true };

describe('six joueurs', () => {
  it('place six départs dégagés, sans caisse autour', () => {
    const state = createRound(6, 11);
    expect(state.players).toHaveLength(6);
    for (const [x, y] of SPAWNS) {
      expect(state.tiles[at(x, y)]).toBe(Tile.Floor);
    }
    const positions = new Set(state.players.map((player) => `${player.x},${player.y}`));
    expect(positions.size).toBe(6);
  });
});

describe('bonus', () => {
  it('cache des bonus sous une partie des caisses seulement, de façon reproductible', () => {
    const a = generateArena('chantier', W, GRID_HEIGHT, 4, 99);
    const b = generateArena('chantier', W, GRID_HEIGHT, 4, 99);
    expect(a.hiddenBonuses).toEqual(b.hiddenBonuses);
    const blocks = a.tiles.filter((tile) => tile === Tile.Block).length;
    const hidden = a.hiddenBonuses.filter((bonus) => bonus !== Bonus.None).length;
    expect(hidden).toBeGreaterThan(0);
    expect(hidden).toBeLessThan(blocks);
    a.hiddenBonuses.forEach((bonus, index) => {
      if (bonus !== Bonus.None) expect(a.tiles[index]).toBe(Tile.Block);
    });
  });

  it('révèle le bonus quand la caisse a brûlé, et le joueur le ramasse en marchant dessus', () => {
    const state = createRound(2, 1);
    clearArena(state);
    state.tiles[at(3, 1)] = Tile.Block;
    state.hiddenBonuses[at(3, 1)] = Bonus.Flame;
    stepRound(state, [BOMB]);
    // On s'abrite dans la colonne 1, hors de portée (la flamme descend de 2 cases).
    run(state, 60, [walk('down')]);
    while (state.bombs.length > 0) stepRound(state, []);
    expect(state.tiles[at(3, 1)]).toBe(Tile.Burning);
    expect(state.bonuses[at(3, 1)]).toBe(Bonus.None);
    run(state, FLAME_TICKS);
    expect(state.players[0].alive).toBe(true);
    expect(state.bonuses[at(3, 1)]).toBe(Bonus.Flame);
    run(state, 60, [walk('up')]);
    run(state, 60, [walk('right')]);
    expect(state.players[0].range).toBe(3);
    expect(state.bonuses[at(3, 1)]).toBe(Bonus.None);
  });

  it('détruit un bonus au sol touché par une flamme', () => {
    const state = createRound(2, 1);
    clearArena(state);
    state.bonuses[at(3, 1)] = Bonus.Speed;
    state.players[0].x = 1.5;
    state.players[0].y = 3.5;
    stepRound(state, [{ direction: null, bomb: false }]);
    state.bombs.push({ id: 99, owner: 1, cx: 1, cy: 1, fuse: 1, range: 3, passThrough: [], remote: false, slide: null, slideProgress: 0 });
    run(state, 2);
    expect(state.bonuses[at(3, 1)]).toBe(Bonus.None);
  });

  it('plafonne les effets cumulés', () => {
    const state = createRound(2, 1);
    const player = state.players[0];
    for (let i = 0; i < 20; i++) {
      applyBonus(player, Bonus.Flame);
      applyBonus(player, Bonus.Bomb);
      applyBonus(player, Bonus.Speed);
    }
    expect(player.range).toBe(8);
    expect(player.maxBombs).toBe(8);
    expect(player.speed).toBeGreaterThan(BASE_SPEED);
    expect(player.speed * 60).toBeCloseTo(5.9);
  });

  it('gilet pare-flamme : encaisse une explosion, puis on redevient vulnérable', () => {
    const state = createRound(2, 1);
    clearArena(state);
    applyBonus(state.players[0], Bonus.Vest);
    stepRound(state, [BOMB]);
    run(state, BOMB_FUSE_TICKS);
    expect(state.players[0].alive).toBe(true);
    expect(state.players[0].vest).toBe(false);
    run(state, VEST_GRACE_TICKS);
    stepRound(state, [BOMB]);
    run(state, BOMB_FUSE_TICKS + 1);
    expect(state.players[0].alive).toBe(false);
  });

  it('détonateur : la bombe attend la commande, puis explose aussitôt', () => {
    const state = createRound(2, 1);
    clearArena(state);
    applyBonus(state.players[0], Bonus.Detonator);
    stepRound(state, [BOMB]);
    run(state, 60, [walk('down')]);
    run(state, BOMB_FUSE_TICKS);
    expect(state.bombs).toHaveLength(1);
    // Une bombe normale aurait explosé depuis longtemps ; celle-ci attend encore.
    expect(state.bombs[0].fuse).toBeGreaterThan(REMOTE_FUSE_TICKS / 2);
    stepRound(state, [{ direction: null, bomb: false, detonate: true }]);
    expect(state.bombs).toHaveLength(0);
    expect(state.flames[at(1, 1)]).toBeGreaterThan(0);
  });

  it('traverse-mur : passe à travers les caisses, mais pas les piliers', () => {
    const state = createRound(2, 1);
    clearArena(state);
    state.tiles[at(2, 1)] = Tile.Block;
    run(state, 30, [walk('right')]);
    expect(state.players[0].x).toBeCloseTo(1.5);
    applyBonus(state.players[0], Bonus.WallPass);
    run(state, 30, [walk('right')]);
    expect(state.players[0].x).toBeGreaterThan(2.5);
    state.players[0].x = 1.5;
    run(state, 17, [walk('down')]);
    expect(cellOf(state.players[0])).toEqual([1, 2]);
    run(state, 30, [walk('right')]);
    // Ligne 2 : la case (2,2) est un pilier.
    expect(cellOf(state.players[0])).toEqual([1, 2]);
  });

  it('traverse-bombe : revient sur sa propre bombe, pas sur celle des autres', () => {
    const state = createRound(2, 1);
    clearArena(state);
    applyBonus(state.players[0], Bonus.BombPass);
    stepRound(state, [BOMB]);
    run(state, 18, [walk('right')]);
    run(state, 30, [walk('left')]);
    expect(cellOf(state.players[0])).toEqual([1, 1]);
    state.bombs.push({ id: 50, owner: 1, cx: 3, cy: 1, fuse: 999, range: 1, passThrough: [], remote: false, slide: null, slideProgress: 0 });
    run(state, 60, [walk('right')]);
    expect(cellOf(state.players[0])).toEqual([2, 1]);
  });

  it('kick : pousse la bombe jusqu’au prochain obstacle', () => {
    const state = createRound(2, 1);
    clearArena(state);
    applyBonus(state.players[0], Bonus.Kick);
    state.bombs.push({ id: 7, owner: 1, cx: 2, cy: 1, fuse: 999, range: 1, passThrough: [], remote: false, slide: null, slideProgress: 0 });
    run(state, 5, [walk('right')]);
    expect(state.bombs[0].slide).toBe('right');
    run(state, 120);
    expect(state.bombs[0].slide).toBeNull();
    expect([state.bombs[0].cx, state.bombs[0].cy]).toEqual([W - 2, 1]);
  });

  it('sans kick, la bombe ne bouge pas', () => {
    const state = createRound(2, 1);
    clearArena(state);
    state.bombs.push({ id: 7, owner: 1, cx: 2, cy: 1, fuse: 999, range: 1, passThrough: [], remote: false, slide: null, slideProgress: 0 });
    run(state, 60, [walk('right')]);
    expect(bombAt(state, 2, 1)).toBeDefined();
    expect(state.bombs[0].slide).toBeNull();
  });
});

describe('arènes', () => {
  it('ne recouvre jamais un élément d’arène par une caisse', () => {
    for (const arena of ARENA_IDS) {
      for (let seed = 0; seed < 20; seed++) {
        const generated = generateArena(arena, W, GRID_HEIGHT, 6, seed);
        generated.features.forEach((feature, index) => {
          if (feature !== Feature.None) expect(generated.tiles[index]).toBe(Tile.Floor);
        });
      }
    }
  });

  it('laboratoire : le téléporteur envoie à l’autre bout, sans renvoi immédiat', () => {
    const state = createRound(2, 1, 'laboratoire');
    clearArena(state);
    const player = state.players[0];
    player.x = 1.5;
    player.y = 4.5;
    run(state, 20, [walk('down')]);
    expect(cellOf(player)).toEqual([W - 2, 5]);
    run(state, 30);
    expect(cellOf(player)).toEqual([W - 2, 5]);
    // Parti puis revenu sur le téléporteur : il fonctionne de nouveau.
    run(state, 20, [walk('up')]);
    run(state, 20, [walk('down')]);
    expect(cellOf(player)).toEqual([1, 5]);
  });

  it('temple : une dalle fissurée s’effondre derrière le joueur et devient infranchissable', () => {
    const state = createRound(2, 1, 'temple');
    clearArena(state);
    const player = state.players[0];
    player.x = 3.5;
    player.y = 4.5;
    run(state, 20, [walk('down')]);
    expect(cellOf(player)).toEqual([3, 5]);
    expect(state.tiles[at(3, 5)]).toBe(Tile.Floor);
    run(state, 40, [walk('down')]);
    expect(state.tiles[at(3, 5)]).toBe(Tile.Pit);
    run(state, 60, [walk('up')]);
    expect(cellOf(player)).toEqual([3, 6]);
  });

  it('station : le tapis roulant emporte le joueur immobile', () => {
    const state = createRound(2, 1, 'station');
    clearArena(state);
    const player = state.players[0];
    player.x = 3.5;
    player.y = 3.5;
    run(state, 60);
    expect(player.x).toBeCloseTo(5.3, 1);
    expect(player.facing).toBe('down');
  });

  it('rotation : une arène différente à chaque manche, les quatre y passent', () => {
    const match = createMatch(2, 5, 'rotation');
    const seen = [1, 2, 3, 4].map((round) => arenaForRound(match, round));
    expect(new Set(seen).size).toBe(4);
    expect(match.round.arena).toBe(seen[0]);
    const fixed = createMatch(2, 5, 'temple');
    expect([1, 2, 3].map((round) => arenaForRound(fixed, round))).toEqual(['temple', 'temple', 'temple']);
  });
});

describe('bonus limités à 10 secondes', () => {
  it('un bonus s’arrête au bout de 10 s', () => {
    const state = createRound(2, 1);
    clearArena(state);
    applyBonus(state.players[0], Bonus.Flame, state.tick);
    applyBonus(state.players[0], Bonus.Kick, state.tick);
    run(state, BONUS_DURATION_TICKS - 1);
    expect(state.players[0].range).toBe(3);
    expect(state.players[0].kick).toBe(true);
    run(state, 1);
    expect(state.players[0].range).toBe(2);
    expect(state.players[0].kick).toBe(false);
  });

  it('reprendre le même bonus relance le compteur et le cumule', () => {
    const state = createRound(2, 1);
    clearArena(state);
    const player = state.players[0];
    applyBonus(player, Bonus.Bomb, state.tick);
    run(state, BONUS_DURATION_TICKS / 2);
    applyBonus(player, Bonus.Bomb, state.tick);
    expect(player.maxBombs).toBe(3);
    run(state, BONUS_DURATION_TICKS - 1);
    expect(player.maxBombs).toBe(3);
    run(state, 1);
    expect(player.maxBombs).toBe(1);
  });

  it('à la fin du Détonateur, les bombes posées redeviennent des bombes normales', () => {
    const state = createRound(2, 1);
    clearArena(state);
    applyBonus(state.players[0], Bonus.Detonator, state.tick);
    stepRound(state, [BOMB]);
    expect(state.bombs[0].remote).toBe(true);
    run(state, 60, [walk('down')]);
    run(state, BONUS_DURATION_TICKS);
    // Le compteur de la bombe est reparti d'au plus 2,5 s : elle a explosé.
    expect(state.bombs).toHaveLength(0);
  });
});

describe('pousser sa bombe', () => {
  it('on pose sa bombe, on revient dessus : elle glisse jusqu’au prochain obstacle', () => {
    const state = createRound(2, 1);
    clearArena(state);
    const player = state.players[0];
    player.x = 3.5;
    stepRound(state, [BOMB]);
    expect(bombAt(state, 3, 1)).toBeDefined();
    // On s'écarte vers la gauche, puis on revient pousser vers la droite.
    run(state, 30, [walk('left')]);
    run(state, 40, [walk('right')]);
    run(state, 60);
    const bomb = state.bombs[0];
    expect(bomb.cx).toBe(W - 2);
    expect(bomb.slide).toBeNull();
  });

  it('la bombe poussée s’arrête contre un joueur', () => {
    const state = createRound(2, 1);
    clearArena(state);
    state.players[0].x = 3.5;
    state.players[1].x = 8.5;
    state.players[1].y = 1.5;
    stepRound(state, [BOMB]);
    run(state, 30, [walk('left')]);
    run(state, 40, [walk('right')]);
    run(state, 60);
    expect(state.bombs[0].cx).toBe(7);
  });
});
