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
  /** Dalle effondrée (Temple englouti) : infranchissable, les flammes passent au-dessus. */
  Pit: 4,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Élément posé au sol, propre à une arène. */
export const Feature = {
  None: 0,
  Teleporter: 1,
  ConveyorUp: 2,
  ConveyorDown: 3,
  ConveyorLeft: 4,
  ConveyorRight: 5,
  /** Dalle fissurée : elle s'effondre une fois qu'un joueur l'a quittée. */
  Cracked: 6,
} as const;
export type Feature = (typeof Feature)[keyof typeof Feature];

export const CONVEYOR_DIRECTIONS: Partial<Record<Feature, Direction>> = {
  [Feature.ConveyorUp]: 'up',
  [Feature.ConveyorDown]: 'down',
  [Feature.ConveyorLeft]: 'left',
  [Feature.ConveyorRight]: 'right',
};

/** Bonus classiques, cachés sous certaines caisses. */
export const Bonus = {
  None: 0,
  /** Flamme+ : portée des explosions +1. */
  Flame: 1,
  /** Bombe+ : une bombe de plus en même temps. */
  Bomb: 2,
  /** Vitesse+ : déplacement plus rapide. */
  Speed: 3,
  /** Gilet pare-flamme : une explosion encaissée sans mourir. */
  Vest: 4,
  /** Détonateur : les bombes n'explosent que sur commande. */
  Detonator: 5,
  /** Traverse-mur : passe à travers les caisses. */
  WallPass: 6,
  /** Traverse-bombe : passe à travers ses propres bombes. */
  BombPass: 7,
  /** Kick : pousse les bombes d'un coup de pied. */
  Kick: 8,
} as const;
export type Bonus = (typeof Bonus)[keyof typeof Bonus];

export const ARENA_IDS = ['chantier', 'laboratoire', 'temple', 'station'] as const;
export type ArenaId = (typeof ARENA_IDS)[number];

export interface PlayerInput {
  direction: Direction | null;
  /** Vrai sur le tick où le joueur demande à poser une bombe. */
  bomb: boolean;
  /** Vrai sur le tick où le joueur déclenche ses bombes (bonus Détonateur). */
  detonate?: boolean;
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
  /** Gilet pare-flamme porté. */
  vest: boolean;
  /** Invulnérable jusqu'à ce tick (juste après avoir perdu son gilet). */
  invulnerableUntil: number;
  detonator: boolean;
  wallPass: boolean;
  bombPass: boolean;
  kick: boolean;
  /**
   * Bonus actifs, indexés par `Bonus` : tick de fin (0 = inactif) et niveau
   * (Flamme+, Bombe+ et Vitesse+ se cumulent). Les caractéristiques ci-dessus
   * (portée, gilet…) en sont déduites à chaque tick.
   */
  buffUntil: number[];
  buffLevel: number[];
  /** Case d'arrivée d'une téléportation : pas de retour avant d'en être sorti. */
  teleportLock: number;
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
  /** Bombe du Détonateur : n'explose que sur commande (ou au bout d'un long délai). */
  remote: boolean;
  /** Bombe poussée (Kick) : direction du glissement. */
  slide: Direction | null;
  /** Avancée vers la case suivante pendant un glissement, de 0 à 1. */
  slideProgress: number;
}

export interface RoundState {
  arena: ArenaId;
  width: number;
  height: number;
  tiles: Tile[];
  /** Éléments au sol propres à l'arène, par case. */
  features: Feature[];
  /** Pour un téléporteur, index de la case d'arrivée (sinon -1). */
  teleportTargets: number[];
  /** Dalles fissurées déjà foulées (1) : elles s'effondrent une fois libres. */
  steppedOn: number[];
  /** Bonus visibles au sol, par case. */
  bonuses: Bonus[];
  /** Bonus cachés sous les caisses : connus du seul serveur, jamais envoyés. */
  hiddenBonuses: Bonus[];
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
  | { type: 'wallDropped'; cx: number; cy: number }
  | { type: 'bonusPicked'; player: number; bonus: Bonus }
  | { type: 'vestLost'; player: number }
  | { type: 'teleported'; player: number }
  | { type: 'floorCollapsed'; cx: number; cy: number }
  | { type: 'bombKicked'; player: number };
