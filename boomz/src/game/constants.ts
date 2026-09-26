// Toute la simulation avance par pas fixes : les durées sont exprimées en ticks.
// Un pas fixe rend la partie déterministe, ce qui préparera le mode en ligne
// (serveur autoritaire, rejeu des entrées) de la phase 2.
export const TICK_RATE = 60;
export const TICK_SECONDS = 1 / TICK_RATE;

export const GRID_WIDTH = 13;
export const GRID_HEIGHT = 11;

/** Proportion des cases libres occupées par un bloc destructible. */
export const BLOCK_DENSITY = 0.72;

export const BOMB_FUSE_TICKS = Math.round(2.5 * TICK_RATE);
export const FLAME_TICKS = Math.round(0.5 * TICK_RATE);

export const BASE_SPEED = 3.4 / TICK_RATE; // cases par tick
export const BASE_RANGE = 2;
export const BASE_MAX_BOMBS = 1;

/** Au-delà d'un léger décalage, le personnage glisse vers le couloir libre le plus proche. */
export const CORNER_ASSIST = 0.3;

// Resserrement de l'arène : passé ce délai, des murs tombent en spirale.
export const SUDDEN_DEATH_TICKS = 120 * TICK_RATE;
export const SUDDEN_DEATH_INTERVAL_TICKS = Math.round(0.4 * TICK_RATE);

export const COUNTDOWN_TICKS = 3 * TICK_RATE;
export const ROUND_OVER_TICKS = Math.round(2.5 * TICK_RATE);
export const WINS_TO_TAKE_MATCH = 3; // best of 5

/** Emplacements de départ, dans l'ordre d'arrivée des joueurs (jusqu'à 6). */
export const SPAWNS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [GRID_WIDTH - 2, GRID_HEIGHT - 2],
  [GRID_WIDTH - 2, 1],
  [1, GRID_HEIGHT - 2],
  [Math.floor(GRID_WIDTH / 2), 1],
  [Math.floor(GRID_WIDTH / 2), GRID_HEIGHT - 2],
];
