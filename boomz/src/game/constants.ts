// Toute la simulation avance par pas fixes : les durées sont exprimées en ticks.
// Un pas fixe rend la partie déterministe : le serveur fait autorité, et le
// même code pourra tourner sur le téléphone hôte en mode Bluetooth.
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

// Bonus : plafonds et effets.
export const SPEED_STEP = 0.5 / TICK_RATE;
export const MAX_SPEED = 5.9 / TICK_RATE;
/** Durée d'un bonus ramassé : reprendre le même bonus relance le compteur. */
export const BONUS_DURATION_TICKS = 10 * TICK_RATE;
/**
 * Échéance des bonus sans limite de temps (le Gilet, usé seulement par une
 * explosion). Un nombre et non `Infinity`, qui deviendrait `null` en JSON.
 */
export const UNTIL_USED = Number.MAX_SAFE_INTEGER;
export const MAX_RANGE = 8;
export const MAX_BOMBS = 8;
/** Probabilité qu'une caisse cache un bonus. */
export const BONUS_DROP_CHANCE = 0.35;
/** Invulnérabilité après avoir perdu le gilet, pour ne pas mourir de la même flamme. */
export const VEST_GRACE_TICKS = TICK_RATE;
/** Une bombe télécommandée oubliée finit quand même par exploser. */
export const REMOTE_FUSE_TICKS = 10 * TICK_RATE;
export const BOMB_SLIDE_SPEED = 7 / TICK_RATE;
export const CONVEYOR_SPEED = 1.8 / TICK_RATE;
/** Distance au centre d'un téléporteur en dessous de laquelle il s'active. */
export const TELEPORT_RADIUS = 0.2;

/** Au-delà d'un léger décalage, le personnage glisse vers le couloir libre le plus proche. */
export const CORNER_ASSIST = 0.3;

// Resserrement de l'arène : passé ce délai, des murs tombent en spirale.
export const SUDDEN_DEATH_TICKS = 120 * TICK_RATE;
export const SUDDEN_DEATH_INTERVAL_TICKS = Math.round(0.4 * TICK_RATE);

export const COUNTDOWN_TICKS = 3 * TICK_RATE;
export const ROUND_OVER_TICKS = Math.round(2.5 * TICK_RATE);
export const WINS_TO_TAKE_MATCH = 3; // best of 5

/** Nombre d'apparences (cosmétiques) par personnage. */
export const SKIN_COUNT = 3;

/** Emplacements de départ, dans l'ordre d'arrivée des joueurs (jusqu'à 6). */
export const SPAWNS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [GRID_WIDTH - 2, GRID_HEIGHT - 2],
  [GRID_WIDTH - 2, 1],
  [1, GRID_HEIGHT - 2],
  [Math.floor(GRID_WIDTH / 2), 1],
  [Math.floor(GRID_WIDTH / 2), GRID_HEIGHT - 2],
];
