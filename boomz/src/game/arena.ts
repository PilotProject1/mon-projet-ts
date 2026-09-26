import { BLOCK_DENSITY, BONUS_DROP_CHANCE, SPAWNS } from './constants';
import { createRng } from './rng';
import { Bonus, Feature, Tile, type ArenaId } from './types';

export function isPillar(x: number, y: number, width: number, height: number): boolean {
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return true;
  return x % 2 === 0 && y % 2 === 0;
}

/** Éléments au sol d'une arène : ils ne sont jamais recouverts d'une caisse. */
interface ArenaLayout {
  features: Feature[];
  teleportTargets: number[];
}

export const ARENA_NAMES: Record<ArenaId, string> = {
  chantier: 'Chantier',
  laboratoire: 'Laboratoire',
  temple: 'Temple englouti',
  station: 'Station spatiale',
};

function arenaLayout(arena: ArenaId, width: number, height: number): ArenaLayout {
  const features = new Array<Feature>(width * height).fill(Feature.None);
  const teleportTargets = new Array<number>(width * height).fill(-1);
  const at = (x: number, y: number) => y * width + x;
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);

  switch (arena) {
    case 'chantier':
      break;
    case 'laboratoire': {
      // Deux paires de téléporteurs : bords gauche/droit, et haut/bas du centre.
      const pairs: Array<[number, number, number, number]> = [
        [1, midY, width - 2, midY],
        [midX, 3, midX, height - 4],
      ];
      for (const [ax, ay, bx, by] of pairs) {
        features[at(ax, ay)] = Feature.Teleporter;
        features[at(bx, by)] = Feature.Teleporter;
        teleportTargets[at(ax, ay)] = at(bx, by);
        teleportTargets[at(bx, by)] = at(ax, ay);
      }
      break;
    }
    case 'temple':
      // Une croix de dalles fissurées au centre : chaque passage les fait tomber.
      for (let x = 3; x <= width - 4; x++) features[at(x, midY)] = Feature.Cracked;
      for (const y of [3, height - 4]) features[at(midX, y)] = Feature.Cracked;
      break;
    case 'station':
      // Deux tapis roulants en sens opposés.
      for (let x = 1; x <= width - 2; x++) {
        features[at(x, 3)] = Feature.ConveyorRight;
        features[at(x, height - 4)] = Feature.ConveyorLeft;
      }
      break;
  }
  return { features, teleportTargets };
}

/**
 * Cases à garder libres autour d'un départ : la case elle-même et ses voisines
 * directes, pour que chaque joueur puisse poser une première bombe et s'abriter.
 */
function spawnSafeCells(width: number, height: number, playerCount: number): Set<number> {
  const safe = new Set<number>();
  for (const [sx, sy] of SPAWNS.slice(0, playerCount)) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = sx + dx;
      const y = sy + dy;
      if (!isPillar(x, y, width, height)) safe.add(y * width + x);
    }
  }
  return safe;
}

export interface GeneratedArena extends ArenaLayout {
  tiles: Tile[];
  /** Bonus cachés sous les caisses. */
  hiddenBonuses: Bonus[];
}

/** Tirage pondéré : les bonus de base sont plus fréquents que les pouvoirs spéciaux. */
const BONUS_WEIGHTS: Array<[Bonus, number]> = [
  [Bonus.Flame, 24],
  [Bonus.Bomb, 24],
  [Bonus.Speed, 16],
  [Bonus.Kick, 10],
  [Bonus.Vest, 8],
  [Bonus.BombPass, 7],
  [Bonus.WallPass, 5],
  [Bonus.Detonator, 6],
];
const TOTAL_WEIGHT = BONUS_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);

function pickBonus(roll: number): Bonus {
  let threshold = roll * TOTAL_WEIGHT;
  for (const [bonus, weight] of BONUS_WEIGHTS) {
    threshold -= weight;
    if (threshold < 0) return bonus;
  }
  return Bonus.Flame;
}

export function generateArena(
  arena: ArenaId,
  width: number,
  height: number,
  playerCount: number,
  seed: number,
): GeneratedArena {
  const rng = createRng(seed);
  const layout = arenaLayout(arena, width, height);
  const safe = spawnSafeCells(width, height, playerCount);
  const tiles: Tile[] = [];
  const hiddenBonuses: Bonus[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      // Deux tirages par case, toujours consommés, pour que l'arène ne dépende que de la graine.
      const blockRoll = rng();
      const bonusRoll = rng();
      if (isPillar(x, y, width, height)) {
        tiles.push(Tile.Wall);
        hiddenBonuses.push(Bonus.None);
      } else if (safe.has(index) || layout.features[index] !== Feature.None || blockRoll >= BLOCK_DENSITY) {
        tiles.push(Tile.Floor);
        hiddenBonuses.push(Bonus.None);
      } else {
        tiles.push(Tile.Block);
        hiddenBonuses.push(bonusRoll < BONUS_DROP_CHANCE ? pickBonus(bonusRoll / BONUS_DROP_CHANCE) : Bonus.None);
      }
    }
  }
  return { ...layout, tiles, hiddenBonuses };
}

/**
 * Ordre dans lequel le mur avance en fin de manche : l'anneau intérieur le
 * plus externe d'abord, en spirale, jusqu'au centre.
 */
export function suddenDeathOrder(width: number, height: number): number[] {
  const order: number[] = [];
  let left = 1;
  let top = 1;
  let right = width - 2;
  let bottom = height - 2;
  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) order.push(top * width + x);
    for (let y = top + 1; y <= bottom; y++) order.push(y * width + right);
    if (top < bottom) for (let x = right - 1; x >= left; x--) order.push(bottom * width + x);
    if (left < right) for (let y = bottom - 1; y > top; y--) order.push(y * width + left);
    left++;
    top++;
    right--;
    bottom--;
  }
  return order.filter((index) => !isPillar(index % width, Math.floor(index / width), width, height));
}
