import { generateTiles, suddenDeathOrder } from './arena';
import {
  BASE_MAX_BOMBS,
  BASE_RANGE,
  BASE_SPEED,
  BOMB_FUSE_TICKS,
  CORNER_ASSIST,
  FLAME_TICKS,
  GRID_HEIGHT,
  GRID_WIDTH,
  SPAWNS,
  SUDDEN_DEATH_INTERVAL_TICKS,
  SUDDEN_DEATH_TICKS,
} from './constants';
import {
  DIRECTION_VECTORS,
  NO_INPUT,
  Tile,
  type Bomb,
  type Direction,
  type Player,
  type PlayerInput,
  type RoundEvent,
  type RoundState,
} from './types';

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export function createRound(playerCount: number, seed: number): RoundState {
  const width = GRID_WIDTH;
  const height = GRID_HEIGHT;
  const players: Player[] = SPAWNS.slice(0, playerCount).map(([x, y], id) => ({
    id,
    x: x + 0.5,
    y: y + 0.5,
    alive: true,
    facing: 'down',
    moving: false,
    speed: BASE_SPEED,
    range: BASE_RANGE,
    maxBombs: BASE_MAX_BOMBS,
    diedAt: null,
  }));
  return {
    width,
    height,
    tiles: generateTiles(width, height, playerCount, seed),
    flames: new Array<number>(width * height).fill(0),
    players,
    bombs: [],
    tick: 0,
    nextBombId: 1,
    suddenDeathOrder: suddenDeathOrder(width, height),
    suddenDeathIndex: 0,
  };
}

export function cellOf(player: Player): [number, number] {
  return [Math.floor(player.x), Math.floor(player.y)];
}

export function bombAt(state: RoundState, cx: number, cy: number): Bomb | undefined {
  return state.bombs.find((bomb) => bomb.cx === cx && bomb.cy === cy);
}

function inBounds(state: RoundState, cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < state.width && cy < state.height;
}

function isWalkable(state: RoundState, cx: number, cy: number, playerId: number): boolean {
  if (!inBounds(state, cx, cy)) return false;
  if (state.tiles[cy * state.width + cx] !== Tile.Floor) return false;
  const bomb = bombAt(state, cx, cy);
  return !bomb || bomb.passThrough.includes(playerId);
}

/**
 * Déplacement case par case façon labyrinthe : le personnage se recentre dans
 * son couloir avant d'avancer, et glisse dans un couloir voisin quand il est
 * suffisamment décalé vers lui, pour que les virages ne coincent pas.
 */
function movePlayer(state: RoundState, player: Player, direction: Direction): void {
  const [dx, dy] = DIRECTION_VECTORS[direction];
  const horizontal = dx !== 0;
  // Axe du mouvement (main) et axe perpendiculaire (cross).
  let main = horizontal ? player.x : player.y;
  let cross = horizontal ? player.y : player.x;
  const step = horizontal ? dx : dy;
  const walkable = (mainCell: number, crossCell: number) =>
    horizontal
      ? isWalkable(state, mainCell, crossCell, player.id)
      : isWalkable(state, crossCell, mainCell, player.id);

  let remaining = player.speed;
  const mainCell = Math.floor(main);
  const crossCell = Math.floor(cross);
  const offset = cross - (crossCell + 0.5);

  if (walkable(mainCell + step, crossCell)) {
    // Recentrage dans le couloir avant d'avancer.
    const shift = Math.min(Math.abs(offset), remaining);
    cross -= Math.sign(offset) * shift;
    remaining -= shift;
  } else if (Math.abs(offset) >= CORNER_ASSIST) {
    // Bloqué, mais assez décalé vers un couloir voisin ouvert : on y glisse.
    const side = Math.sign(offset);
    if (walkable(mainCell, crossCell + side) && walkable(mainCell + step, crossCell + side)) {
      cross += side * remaining;
      remaining = 0;
    }
  }

  if (remaining > 0) {
    let next = main + step * remaining;
    const nextCell = Math.floor(next);
    if (nextCell !== mainCell && !walkable(nextCell, crossCell)) next = mainCell + 0.5;
    // Ne pas dépasser le centre d'une case dont la suivante est bloquée.
    const landing = Math.floor(next);
    const center = landing + 0.5;
    if (!walkable(landing + step, crossCell) && (next - center) * step > 0) {
      next = (main - center) * step > 0 ? main : center;
    }
    main = next;
  }

  if (horizontal) {
    player.x = main;
    player.y = cross;
  } else {
    player.y = main;
    player.x = cross;
  }
}

function placeBomb(state: RoundState, player: Player, events: RoundEvent[]): void {
  const [cx, cy] = cellOf(player);
  if (state.tiles[cy * state.width + cx] !== Tile.Floor) return;
  if (bombAt(state, cx, cy)) return;
  const active = state.bombs.filter((bomb) => bomb.owner === player.id).length;
  if (active >= player.maxBombs) return;
  const passThrough = state.players
    .filter((other) => other.alive && cellOf(other)[0] === cx && cellOf(other)[1] === cy)
    .map((other) => other.id);
  state.bombs.push({
    id: state.nextBombId++,
    owner: player.id,
    cx,
    cy,
    fuse: BOMB_FUSE_TICKS,
    range: player.range,
    passThrough,
  });
  events.push({ type: 'bombPlaced', player: player.id });
}

function explode(state: RoundState, bomb: Bomb, events: RoundEvent[]): void {
  state.bombs = state.bombs.filter((other) => other !== bomb);
  events.push({ type: 'explosion', cx: bomb.cx, cy: bomb.cy });
  state.flames[bomb.cy * state.width + bomb.cx] = FLAME_TICKS;
  for (const direction of DIRECTIONS) {
    const [dx, dy] = DIRECTION_VECTORS[direction];
    for (let distance = 1; distance <= bomb.range; distance++) {
      const x = bomb.cx + dx * distance;
      const y = bomb.cy + dy * distance;
      if (!inBounds(state, x, y)) break;
      const index = y * state.width + x;
      const tile = state.tiles[index];
      if (tile === Tile.Wall || tile === Tile.Burning) break;
      state.flames[index] = FLAME_TICKS;
      if (tile === Tile.Block) {
        state.tiles[index] = Tile.Burning;
        events.push({ type: 'blockDestroyed', cx: x, cy: y });
        break;
      }
      const hit = bombAt(state, x, y);
      if (hit) {
        // Réaction en chaîne : la bombe touchée explose dans le même tick.
        hit.fuse = 0;
        break;
      }
    }
  }
}

function dropSuddenDeathWall(state: RoundState, events: RoundEvent[]): void {
  while (state.suddenDeathIndex < state.suddenDeathOrder.length) {
    const index = state.suddenDeathOrder[state.suddenDeathIndex++];
    if (state.tiles[index] === Tile.Wall) continue;
    const cx = index % state.width;
    const cy = Math.floor(index / state.width);
    state.tiles[index] = Tile.Wall;
    state.flames[index] = 0;
    state.bombs = state.bombs.filter((bomb) => bomb.cx !== cx || bomb.cy !== cy);
    for (const player of state.players) {
      const [px, py] = cellOf(player);
      if (player.alive && px === cx && py === cy) killPlayer(state, player, events);
    }
    events.push({ type: 'wallDropped', cx, cy });
    return;
  }
}

function killPlayer(state: RoundState, player: Player, events: RoundEvent[]): void {
  player.alive = false;
  player.moving = false;
  player.diedAt = state.tick;
  events.push({ type: 'playerDied', player: player.id });
}

/** Avance la manche d'un tick. `inputs[i]` est l'entrée du joueur i. */
export function stepRound(state: RoundState, inputs: ReadonlyArray<PlayerInput>): RoundEvent[] {
  const events: RoundEvent[] = [];
  state.tick++;

  for (const player of state.players) {
    if (!player.alive) continue;
    const input = inputs[player.id] ?? NO_INPUT;
    if (input.bomb) placeBomb(state, player, events);
    player.moving = input.direction !== null;
    if (input.direction) {
      player.facing = input.direction;
      movePlayer(state, player, input.direction);
    }
  }

  // Un joueur ne peut plus revenir sur une bombe dont il est sorti.
  for (const bomb of state.bombs) {
    bomb.passThrough = bomb.passThrough.filter((id) => {
      const [px, py] = cellOf(state.players[id]);
      return px === bomb.cx && py === bomb.cy;
    });
  }

  for (let i = 0; i < state.flames.length; i++) {
    if (state.flames[i] > 0 && --state.flames[i] === 0 && state.tiles[i] === Tile.Burning) {
      state.tiles[i] = Tile.Floor;
    }
  }

  for (const bomb of state.bombs) bomb.fuse--;
  let ready = state.bombs.find((bomb) => bomb.fuse <= 0);
  while (ready) {
    explode(state, ready, events);
    ready = state.bombs.find((bomb) => bomb.fuse <= 0);
  }

  // Une bombe atteinte par une flamme encore active explose aussi.
  for (const bomb of state.bombs) {
    if (state.flames[bomb.cy * state.width + bomb.cx] > 0) bomb.fuse = 1;
  }

  if (state.tick >= SUDDEN_DEATH_TICKS && (state.tick - SUDDEN_DEATH_TICKS) % SUDDEN_DEATH_INTERVAL_TICKS === 0) {
    dropSuddenDeathWall(state, events);
  }

  for (const player of state.players) {
    if (!player.alive) continue;
    const [px, py] = cellOf(player);
    if (state.flames[py * state.width + px] > 0) killPlayer(state, player, events);
  }

  return events;
}

export function alivePlayers(state: RoundState): Player[] {
  return state.players.filter((player) => player.alive);
}
