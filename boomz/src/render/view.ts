import {
  CONVEYOR_DIRECTIONS,
  Feature,
  type Bomb,
  type Direction,
  type Player,
  type RoundState,
} from '../game/types';

/**
 * Affichage pivoté d'un quart de tour (sens horaire), utilisé quand l'écran est
 * plus haut que large : l'arène de 13 × 11 devient 11 × 13 et occupe la
 * hauteur du téléphone. La partie elle-même ne change pas, seule la vue tourne.
 *
 * Case (x, y) de l'arène → colonne `height - 1 - y`, ligne `x` à l'écran.
 */

/** Direction dans l'arène → direction à l'écran. */
const GRID_TO_SCREEN: Record<Direction, Direction> = { right: 'down', down: 'left', left: 'up', up: 'right' };
/** Direction à l'écran → direction dans l'arène (pour le joystick et le clavier). */
const SCREEN_TO_GRID: Record<Direction, Direction> = { down: 'right', left: 'down', up: 'left', right: 'up' };

const CONVEYOR_FEATURE: Record<Direction, Feature> = {
  up: Feature.ConveyorUp,
  down: Feature.ConveyorDown,
  left: Feature.ConveyorLeft,
  right: Feature.ConveyorRight,
};

export function screenToGrid(direction: Direction, rotated: boolean): Direction {
  return rotated ? SCREEN_TO_GRID[direction] : direction;
}

/** Manche telle qu'elle apparaît à l'écran : identique, ou pivotée d'un quart de tour. */
export function toScreenRound(round: RoundState, rotated: boolean): RoundState {
  if (!rotated) return round;
  const { width, height } = round;
  // Nouvelle grille : `height` colonnes, `width` lignes.
  const index = (x: number, y: number) => x * height + (height - 1 - y);
  const remap = <T>(values: T[]): T[] => {
    const out = new Array<T>(values.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) out[index(x, y)] = values[y * width + x];
    }
    return out;
  };
  const features = remap(round.features).map((feature) => {
    const direction = CONVEYOR_DIRECTIONS[feature];
    return direction ? CONVEYOR_FEATURE[GRID_TO_SCREEN[direction]] : feature;
  });
  const teleportTargets = remap(round.teleportTargets).map((target) =>
    target === -1 ? -1 : index(target % width, Math.floor(target / width)),
  );
  const players: Player[] = round.players.map((player) => ({
    ...player,
    x: height - player.y,
    y: player.x,
    facing: GRID_TO_SCREEN[player.facing],
  }));
  const bombs: Bomb[] = round.bombs.map((bomb) => ({
    ...bomb,
    cx: height - 1 - bomb.cy,
    cy: bomb.cx,
    slide: bomb.slide ? GRID_TO_SCREEN[bomb.slide] : null,
  }));
  return {
    ...round,
    width: height,
    height: width,
    tiles: remap(round.tiles),
    features,
    teleportTargets,
    steppedOn: remap(round.steppedOn),
    bonuses: remap(round.bonuses),
    hiddenBonuses: [],
    flames: remap(round.flames),
    players,
    bombs,
  };
}
