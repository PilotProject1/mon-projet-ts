import { generateArena, suddenDeathOrder } from './arena';
import {
  BASE_MAX_BOMBS,
  BASE_RANGE,
  BASE_SPEED,
  BOMB_FUSE_TICKS,
  BOMB_SLIDE_SPEED,
  BONUS_DURATION_TICKS,
  UNTIL_USED,
  CONVEYOR_SPEED,
  CORNER_ASSIST,
  FLAME_TICKS,
  GRID_HEIGHT,
  GRID_WIDTH,
  MAX_BOMBS,
  MAX_RANGE,
  MAX_SPEED,
  REMOTE_FUSE_TICKS,
  SPAWNS,
  SPEED_STEP,
  SUDDEN_DEATH_INTERVAL_TICKS,
  SUDDEN_DEATH_TICKS,
  TELEPORT_RADIUS,
  VEST_GRACE_TICKS,
} from './constants';
import {
  Bonus,
  CONVEYOR_DIRECTIONS,
  DIRECTION_VECTORS,
  Feature,
  NO_INPUT,
  Tile,
  type ArenaId,
  type Bomb,
  type Direction,
  type Player,
  type PlayerInput,
  type RoundEvent,
  type RoundState,
} from './types';

import {
  BLAST_FUSE_TICKS,
  CHARACTERS,
  DASH_SPEED,
  DASH_TICKS,
  defaultCharacter,
  FREEZE_RADIUS,
  FREEZE_TICKS,
  Hero,
  POWER_START_TICKS,
  SHELL_SLOWDOWN,
  SHELL_TICKS,
  SURCHARGE_RANGE,
  SURCHARGE_TICKS,
  TOXIC_CLOUD_TICKS,
  TOXIC_POWER_TICKS,
} from './powers';

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export function createPlayer(id: number, x: number, y: number, character = defaultCharacter(id)): Player {
  return {
    id,
    x: x + 0.5,
    y: y + 0.5,
    alive: true,
    facing: 'down',
    moving: false,
    speed: BASE_SPEED,
    range: BASE_RANGE,
    maxBombs: BASE_MAX_BOMBS,
    vest: false,
    invulnerableUntil: 0,
    detonator: false,
    wallPass: false,
    bombPass: false,
    kick: false,
    buffUntil: new Array<number>(9).fill(0),
    buffLevel: new Array<number>(9).fill(0),
    teleportLock: -1,
    diedAt: null,
    character,
    powerReadyAt: POWER_START_TICKS,
    effect: -1,
    effectUntil: 0,
    frozenUntil: 0,
  };
}

/**
 * `characters` : personnage de chaque joueur (par défaut, celui de sa place) ;
 * `powers` : pouvoirs des personnages actifs.
 */
export function createRound(
  playerCount: number,
  seed: number,
  arena: ArenaId = 'chantier',
  characters: readonly number[] = [],
  powers = false,
  teams: readonly number[] | null = null,
): RoundState {
  const width = GRID_WIDTH;
  const height = GRID_HEIGHT;
  const generated = generateArena(arena, width, height, playerCount, seed);
  return {
    arena,
    width,
    height,
    tiles: generated.tiles,
    features: generated.features,
    teleportTargets: generated.teleportTargets,
    steppedOn: new Array<number>(width * height).fill(0),
    bonuses: new Array<Bonus>(width * height).fill(Bonus.None),
    hiddenBonuses: generated.hiddenBonuses,
    flames: new Array<number>(width * height).fill(0),
    flameOwners: new Array<number>(width * height).fill(0),
    teams: teams ? teams.slice(0, playerCount) : null,
    players: SPAWNS.slice(0, playerCount).map(([x, y], id) => createPlayer(id, x, y, characters[id] ?? defaultCharacter(id))),
    bombs: [],
    tick: 0,
    nextBombId: 1,
    suddenDeathOrder: suddenDeathOrder(width, height),
    suddenDeathIndex: 0,
    powers,
    toxic: new Array<number>(width * height).fill(0),
    toxicOwner: new Array<number>(width * height).fill(-1),
  };
}

/** Deux joueurs différents de la même équipe (jamais en chacun pour soi). */
export function areTeammates(state: Pick<RoundState, 'teams'>, a: number, b: number): boolean {
  return a !== b && state.teams !== null && state.teams[a] === state.teams[b];
}

/** Un autre joueur, qui n'est pas un coéquipier. */
export function isOpponent(state: Pick<RoundState, 'teams'>, a: number, b: number): boolean {
  return a !== b && !areTeammates(state, a, b);
}

/**
 * La flamme de cette case blesse-t-elle ce joueur ? En équipes, celles des
 * coéquipiers l'épargnent ; les siennes et celles des adversaires, non.
 */
function flameHurts(state: RoundState, index: number, player: number): boolean {
  const owners = state.flameOwners[index];
  if (state.teams === null || owners === 0) return true;
  for (let id = 0; id < state.players.length; id++) {
    if (owners & (1 << id) && !areTeammates(state, id, player)) return true;
  }
  return false;
}

/** Effet de pouvoir en cours chez ce joueur ? */
export function hasEffect(state: RoundState, player: Player, power: number): boolean {
  return player.effect === power && player.effectUntil > state.tick;
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

function isWalkable(state: RoundState, cx: number, cy: number, player: Player): boolean {
  if (!inBounds(state, cx, cy)) return false;
  const tile = state.tiles[cy * state.width + cx];
  if (tile !== Tile.Floor && !(tile === Tile.Block && player.wallPass)) return false;
  const bomb = bombAt(state, cx, cy);
  if (!bomb) return true;
  // En plein Dash (Rocket), on passe par-dessus les bombes.
  if (player.effect === Hero.Rocket && player.effectUntil > state.tick) return true;
  return bomb.passThrough.includes(player.id) || (player.bombPass && bomb.owner === player.id);
}

/** Une bombe peut glisser vers cette case : sol libre, sans bombe ni joueur. */
function canBombEnter(state: RoundState, cx: number, cy: number): boolean {
  if (!inBounds(state, cx, cy)) return false;
  if (state.tiles[cy * state.width + cx] !== Tile.Floor) return false;
  if (bombAt(state, cx, cy)) return false;
  return !state.players.some((player) => {
    if (!player.alive) return false;
    const [px, py] = cellOf(player);
    return px === cx && py === cy;
  });
}

/**
 * Déplacement case par case façon labyrinthe : le personnage se recentre dans
 * son couloir avant d'avancer, et glisse dans un couloir voisin quand il est
 * suffisamment décalé vers lui, pour que les virages ne coincent pas.
 * Renvoie vrai si le personnage bute contre une bombe (pour le Kick).
 */
function movePlayer(state: RoundState, player: Player, direction: Direction, distance: number): Bomb | null {
  const [dx, dy] = DIRECTION_VECTORS[direction];
  const horizontal = dx !== 0;
  // Axe du mouvement (main) et axe perpendiculaire (cross).
  let main = horizontal ? player.x : player.y;
  let cross = horizontal ? player.y : player.x;
  const step = horizontal ? dx : dy;
  const walkable = (mainCell: number, crossCell: number) =>
    horizontal ? isWalkable(state, mainCell, crossCell, player) : isWalkable(state, crossCell, mainCell, player);

  let remaining = distance;
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

  // Arrêté au centre de sa case face à une bombe : c'est elle qui bloque.
  const [px, py] = cellOf(player);
  const stopped = Math.abs(main - (Math.floor(main) + 0.5)) < 0.02 && Math.abs(cross - (Math.floor(cross) + 0.5)) < 0.2;
  const ahead = bombAt(state, px + dx, py + dy);
  return stopped && ahead && !walkable(Math.floor(main) + step, Math.floor(cross)) ? ahead : null;
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
    fuse: player.detonator ? REMOTE_FUSE_TICKS : BOMB_FUSE_TICKS,
    range: hasEffect(state, player, Hero.Boomer) ? Math.min(MAX_RANGE, player.range + SURCHARGE_RANGE) : player.range,
    passThrough,
    remote: player.detonator,
    slide: null,
    slideProgress: 0,
  });
  events.push({ type: 'bombPlaced', player: player.id });
}

/** Joueurs présents sur une case. */
function playersOn(state: RoundState, cx: number, cy: number): Player[] {
  return state.players.filter((other) => other.alive && cellOf(other)[0] === cx && cellOf(other)[1] === cy);
}

/**
 * Pouvoir d'un personnage, utilisé par ce joueur (le sien, ou celui qu'Omega
 * copie). Renvoie le pouvoir réellement utilisé, ou -1 s'il n'a rien pu
 * faire : le pouvoir n'est alors pas consommé.
 */
function applyPower(state: RoundState, player: Player, power: number, events: RoundEvent[]): number {
  switch (power) {
    case Hero.Boomer:
    case Hero.Toxic:
    case Hero.Rocco:
      player.effect = power;
      player.effectUntil = state.tick + (power === Hero.Boomer ? SURCHARGE_TICKS : power === Hero.Toxic ? TOXIC_POWER_TICKS : SHELL_TICKS);
      return power;
    case Hero.Blaster: {
      const own = state.bombs.filter((bomb) => bomb.owner === player.id && !bomb.decoy);
      // Un tiers de seconde pour réagir : assez pour un réflexe, pas pour fuir loin.
      for (const bomb of own) bomb.fuse = Math.min(bomb.fuse, BLAST_FUSE_TICKS);
      return own.length > 0 ? power : -1;
    }
    case Hero.Frost: {
      let hit = false;
      for (const other of state.players) {
        if (!other.alive || !isOpponent(state, player.id, other.id)) continue;
        if (Math.hypot(other.x - player.x, other.y - player.y) > FREEZE_RADIUS) continue;
        other.frozenUntil = state.tick + FREEZE_TICKS;
        other.moving = false;
        events.push({ type: 'frozen', player: other.id });
        hit = true;
      }
      return hit ? power : -1;
    }
    case Hero.Boomette: {
      const [cx, cy] = cellOf(player);
      if (state.tiles[cy * state.width + cx] !== Tile.Floor || bombAt(state, cx, cy)) return -1;
      state.bombs.push({
        id: state.nextBombId++,
        owner: player.id,
        cx,
        cy,
        fuse: BOMB_FUSE_TICKS,
        range: player.range,
        passThrough: playersOn(state, cx, cy).map((other) => other.id),
        remote: false,
        slide: null,
        slideProgress: 0,
        decoy: true,
      });
      return power;
    }
    case Hero.Omega: {
      // Le pouvoir de l'adversaire le plus proche (sauf un autre Omega).
      let nearest: Player | null = null;
      let best = Infinity;
      for (const other of state.players) {
        if (!other.alive || !isOpponent(state, player.id, other.id) || other.character === Hero.Omega) continue;
        const distance = Math.hypot(other.x - player.x, other.y - player.y);
        if (distance < best) {
          best = distance;
          nearest = other;
        }
      }
      return nearest === null ? -1 : applyPower(state, player, nearest.character, events);
    }
    case Hero.Rocket:
      player.effect = Hero.Rocket;
      player.effectUntil = state.tick + DASH_TICKS;
      return power;
    default:
      return -1;
  }
}

/** Le joueur utilise son pouvoir, s'il est rechargé. */
function usePower(state: RoundState, player: Player, events: RoundEvent[]): void {
  if (!state.powers || state.tick < player.powerReadyAt) return;
  const info = CHARACTERS[player.character];
  if (!info) return;
  const before = events.length;
  const used = applyPower(state, player, player.character, events);
  if (used === -1) return;
  player.powerReadyAt = state.tick + info.cooldown;
  // Pour Omega, l'événement indique le pouvoir copié.
  events.splice(before, 0, { type: 'powerUsed', player: player.id, power: used });
}

function explode(state: RoundState, bomb: Bomb, events: RoundEvent[]): void {
  state.bombs = state.bombs.filter((other) => other !== bomb);
  if (bomb.decoy) {
    // Le leurre de Boomette : pouf, rien.
    events.push({ type: 'decoyGone', cx: bomb.cx, cy: bomb.cy });
    return;
  }
  events.push({ type: 'explosion', cx: bomb.cx, cy: bomb.cy });
  const owner = state.players[bomb.owner];
  const toxic = owner ? hasEffect(state, owner, Hero.Toxic) : false;
  const poison = (index: number) => {
    if (!toxic) return;
    state.toxic[index] = TOXIC_CLOUD_TICKS;
    state.toxicOwner[index] = bomb.owner;
  };
  const ignite = (index: number) => {
    state.flames[index] = FLAME_TICKS;
    state.flameOwners[index] |= 1 << bomb.owner;
  };
  ignite(bomb.cy * state.width + bomb.cx);
  poison(bomb.cy * state.width + bomb.cx);
  for (const direction of DIRECTIONS) {
    const [dx, dy] = DIRECTION_VECTORS[direction];
    for (let distance = 1; distance <= bomb.range; distance++) {
      const x = bomb.cx + dx * distance;
      const y = bomb.cy + dy * distance;
      if (!inBounds(state, x, y)) break;
      const index = y * state.width + x;
      const tile = state.tiles[index];
      if (tile === Tile.Wall || tile === Tile.Burning) break;
      ignite(index);
      if (tile === Tile.Block) {
        state.tiles[index] = Tile.Burning;
        events.push({ type: 'blockDestroyed', cx: x, cy: y });
        break;
      }
      poison(index);
      if (state.bonuses[index] !== Bonus.None) {
        // Un bonus au sol est détruit par la flamme, qui s'arrête dessus.
        state.bonuses[index] = Bonus.None;
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
    state.flameOwners[index] = 0;
    state.features[index] = Feature.None;
    state.bonuses[index] = Bonus.None;
    state.hiddenBonuses[index] = Bonus.None;
    state.toxic[index] = 0;
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

/** Niveau maximal des bonus cumulables (au-delà, seul le compteur est relancé). */
const MAX_LEVEL: Partial<Record<Bonus, number>> = {
  [Bonus.Flame]: MAX_RANGE - BASE_RANGE,
  [Bonus.Bomb]: MAX_BOMBS - BASE_MAX_BOMBS,
  [Bonus.Speed]: Math.round((MAX_SPEED - BASE_SPEED) / SPEED_STEP),
};

/**
 * Ramassage d'un bonus : actif pendant 10 secondes à partir de `tick`.
 * Reprendre le même relance le compteur (et monte d'un niveau s'il se cumule).
 * Le Gilet fait exception : il dure jusqu'à ce qu'une explosion l'use.
 */
export function applyBonus(player: Player, bonus: Bonus, tick = 0): void {
  if (bonus === Bonus.None) return;
  const active = player.buffUntil[bonus] > tick;
  const max = MAX_LEVEL[bonus] ?? 1;
  player.buffLevel[bonus] = Math.min(max, (active ? player.buffLevel[bonus] : 0) + 1);
  player.buffUntil[bonus] = bonus === Bonus.Vest ? UNTIL_USED : tick + BONUS_DURATION_TICKS;
  refreshBuffs(player, tick);
}

/** Recalcule les caractéristiques du joueur d'après ses bonus encore actifs. */
function refreshBuffs(player: Player, tick: number): void {
  const level = (bonus: Bonus) => (player.buffUntil[bonus] > tick ? player.buffLevel[bonus] : 0);
  player.range = BASE_RANGE + level(Bonus.Flame);
  player.maxBombs = BASE_MAX_BOMBS + level(Bonus.Bomb);
  player.speed = Math.min(MAX_SPEED, BASE_SPEED + level(Bonus.Speed) * SPEED_STEP);
  player.vest = level(Bonus.Vest) > 0;
  player.detonator = level(Bonus.Detonator) > 0;
  player.wallPass = level(Bonus.WallPass) > 0;
  player.bombPass = level(Bonus.BombPass) > 0;
  player.kick = level(Bonus.Kick) > 0;
}

/** Fin des bonus arrivés à expiration ; les bombes télécommandées redeviennent normales. */
function expireBuffs(state: RoundState): void {
  for (const player of state.players) {
    const hadDetonator = player.detonator;
    refreshBuffs(player, state.tick);
    if (hadDetonator && !player.detonator) {
      for (const bomb of state.bombs) {
        if (bomb.owner === player.id && bomb.remote) {
          bomb.remote = false;
          bomb.fuse = Math.min(bomb.fuse, BOMB_FUSE_TICKS);
        }
      }
    }
  }
}

function slideBombs(state: RoundState): void {
  for (const bomb of state.bombs) {
    if (!bomb.slide) continue;
    const [dx, dy] = DIRECTION_VECTORS[bomb.slide];
    if (!canBombEnter(state, bomb.cx + dx, bomb.cy + dy)) {
      bomb.slide = null;
      bomb.slideProgress = 0;
      continue;
    }
    bomb.slideProgress += BOMB_SLIDE_SPEED;
    if (bomb.slideProgress >= 1) {
      bomb.cx += dx;
      bomb.cy += dy;
      bomb.slideProgress -= 1;
    }
  }
}

/** Téléporteurs, tapis roulants et dalles fissurées. */
function applyArenaFeatures(state: RoundState, events: RoundEvent[]): void {
  for (const player of state.players) {
    if (!player.alive) continue;
    let [px, py] = cellOf(player);
    let index = py * state.width + px;
    const feature = state.features[index];

    const conveyor = CONVEYOR_DIRECTIONS[feature];
    if (conveyor) {
      // Le tapis emporte le joueur sans changer la direction de son regard.
      movePlayer(state, player, conveyor, CONVEYOR_SPEED);
      [px, py] = cellOf(player);
      index = py * state.width + px;
    }

    if (player.teleportLock !== -1 && player.teleportLock !== index) player.teleportLock = -1;
    if (state.features[index] === Feature.Teleporter && player.teleportLock === -1) {
      const near = Math.hypot(player.x - (px + 0.5), player.y - (py + 0.5)) <= TELEPORT_RADIUS;
      const target = state.teleportTargets[index];
      const tx = target % state.width;
      const ty = Math.floor(target / state.width);
      if (near && target !== -1 && state.tiles[target] === Tile.Floor && !bombAt(state, tx, ty)) {
        player.x = tx + 0.5;
        player.y = ty + 0.5;
        player.teleportLock = target;
        events.push({ type: 'teleported', player: player.id });
      }
    }

    [px, py] = cellOf(player);
    index = py * state.width + px;
    if (state.features[index] === Feature.Cracked) state.steppedOn[index] = 1;
  }

  // Une dalle fissurée foulée s'effondre dès qu'elle est libre.
  for (let index = 0; index < state.features.length; index++) {
    if (state.features[index] !== Feature.Cracked || !state.steppedOn[index]) continue;
    const cx = index % state.width;
    const cy = Math.floor(index / state.width);
    const occupied = state.players.some((player) => player.alive && cellOf(player)[0] === cx && cellOf(player)[1] === cy);
    if (occupied || bombAt(state, cx, cy)) continue;
    state.tiles[index] = Tile.Pit;
    state.features[index] = Feature.None;
    state.bonuses[index] = Bonus.None;
    events.push({ type: 'floorCollapsed', cx, cy });
  }
}

/** Avance la manche d'un tick. `inputs[i]` est l'entrée du joueur i. */
export function stepRound(state: RoundState, inputs: ReadonlyArray<PlayerInput>): RoundEvent[] {
  const events: RoundEvent[] = [];
  state.tick++;
  expireBuffs(state);

  for (const player of state.players) {
    if (!player.alive) continue;
    // Gelé : il ne fait rien jusqu'au dégel.
    if (player.frozenUntil > state.tick) {
      player.moving = false;
      continue;
    }
    const input = inputs[player.id] ?? NO_INPUT;
    if (input.power) usePower(state, player, events);
    // Dash de Rocket : il fonce tout droit, quelle que soit la commande.
    if (hasEffect(state, player, Hero.Rocket)) {
      player.moving = true;
      movePlayer(state, player, player.facing, DASH_SPEED);
      const [cx, cy] = cellOf(player);
      const under = bombAt(state, cx, cy);
      // Arrêté sur une bombe : il peut en sortir, comme après l'avoir posée.
      if (under && !under.passThrough.includes(player.id)) under.passThrough.push(player.id);
      continue;
    }
    if (input.bomb) placeBomb(state, player, events);
    if (input.detonate && player.detonator) {
      for (const bomb of state.bombs) if (bomb.owner === player.id && bomb.remote) bomb.fuse = 0;
    }
    player.moving = input.direction !== null;
    if (input.direction) {
      player.facing = input.direction;
      const speed = hasEffect(state, player, Hero.Rocco) ? player.speed * SHELL_SLOWDOWN : player.speed;
      const blocker = movePlayer(state, player, input.direction, speed);
      // On pousse toujours ses propres bombes ; le bonus Kick permet de pousser celles des autres.
      if (blocker && !blocker.slide && (blocker.owner === player.id || player.kick)) {
        blocker.slide = input.direction;
        blocker.slideProgress = 0;
        events.push({ type: 'bombKicked', player: player.id });
      }
    }
  }

  applyArenaFeatures(state, events);
  slideBombs(state);

  // Un joueur ne peut plus revenir sur une bombe dont il est sorti.
  for (const bomb of state.bombs) {
    bomb.passThrough = bomb.passThrough.filter((id) => {
      const [px, py] = cellOf(state.players[id]);
      return px === bomb.cx && py === bomb.cy;
    });
  }

  for (let i = 0; i < state.toxic.length; i++) if (state.toxic[i] > 0) state.toxic[i]--;

  for (let i = 0; i < state.flames.length; i++) {
    if (state.flames[i] > 0 && state.flames[i] === 1) state.flameOwners[i] = 0;
    if (state.flames[i] > 0 && --state.flames[i] === 0 && state.tiles[i] === Tile.Burning) {
      // La caisse disparaît et révèle le bonus qu'elle cachait.
      state.tiles[i] = Tile.Floor;
      state.bonuses[i] = state.hiddenBonuses[i];
      state.hiddenBonuses[i] = Bonus.None;
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
    const index = py * state.width + px;
    const poisoned = state.toxic[index] > 0 && isOpponent(state, state.toxicOwner[index], player.id);
    const burnt = state.flames[index] > 0 && flameHurts(state, index, player.id);
    const shielded = hasEffect(state, player, Hero.Rocco);
    if ((burnt || poisoned) && !shielded && state.tick >= player.invulnerableUntil) {
      if (player.vest) {
        player.buffUntil[Bonus.Vest] = 0;
        player.vest = false;
        player.invulnerableUntil = state.tick + VEST_GRACE_TICKS;
        events.push({ type: 'vestLost', player: player.id });
      } else {
        killPlayer(state, player, events);
        continue;
      }
    }
    const bonus = state.bonuses[index];
    if (bonus !== Bonus.None && state.tiles[index] === Tile.Floor) {
      applyBonus(player, bonus, state.tick);
      state.bonuses[index] = Bonus.None;
      events.push({ type: 'bonusPicked', player: player.id, bonus });
    }
  }

  return events;
}

/** Élimine un joueur hors des règles du jeu (par exemple, déconnexion). */
export function eliminatePlayer(state: RoundState, playerId: number): void {
  const player = state.players[playerId];
  if (player?.alive) killPlayer(state, player, []);
}

export function alivePlayers(state: RoundState): Player[] {
  return state.players.filter((player) => player.alive);
}
