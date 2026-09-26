import { BLOCK_DENSITY, SPAWNS } from './constants';
import { createRng } from './rng';
import { Tile } from './types';

export function isPillar(x: number, y: number, width: number, height: number): boolean {
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return true;
  return x % 2 === 0 && y % 2 === 0;
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

export function generateTiles(width: number, height: number, playerCount: number, seed: number): Tile[] {
  const rng = createRng(seed);
  const safe = spawnSafeCells(width, height, playerCount);
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isPillar(x, y, width, height)) tiles.push(Tile.Wall);
      else if (safe.has(y * width + x)) tiles.push(Tile.Floor);
      else tiles.push(rng() < BLOCK_DENSITY ? Tile.Block : Tile.Floor);
    }
  }
  return tiles;
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
