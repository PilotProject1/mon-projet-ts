export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTION_VECTORS: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const Tile = {
  Floor: 0,
  Wall: 1,
  Block: 2,
  /** Bloc touché par une flamme : il arrête encore les flammes jusqu'à disparaître. */
  Burning: 3,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export interface PlayerInput {
  direction: Direction | null;
  /** Vrai sur le tick où le joueur demande à poser une bombe. */
  bomb: boolean;
}

export const NO_INPUT: PlayerInput = { direction: null, bomb: false };

export interface Player {
  id: number;
  /** Position du centre du personnage, en cases (le centre de la case (0,0) est 0.5, 0.5). */
  x: number;
  y: number;
  alive: boolean;
  facing: Direction;
  moving: boolean;
  speed: number;
  range: number;
  maxBombs: number;
  /** Tick de l'élimination, pour l'animation. */
  diedAt: number | null;
}

export interface Bomb {
  id: number;
  owner: number;
  cx: number;
  cy: number;
  fuse: number;
  range: number;
  /** Joueurs présents sur la case à la pose : ils peuvent en sortir, pas y revenir. */
  passThrough: number[];
}

export interface RoundState {
  width: number;
  height: number;
  tiles: Tile[];
  /** Ticks restants de flamme pour chaque case (0 = pas de flamme). */
  flames: number[];
  players: Player[];
  bombs: Bomb[];
  tick: number;
  nextBombId: number;
  /** Cases à murer pendant le resserrement, dans l'ordre. */
  suddenDeathOrder: number[];
  suddenDeathIndex: number;
}

export type RoundEvent =
  | { type: 'bombPlaced'; player: number }
  | { type: 'explosion'; cx: number; cy: number }
  | { type: 'blockDestroyed'; cx: number; cy: number }
  | { type: 'playerDied'; player: number }
  | { type: 'wallDropped'; cx: number; cy: number };
