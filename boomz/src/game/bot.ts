import { BOMB_FUSE_TICKS, FLAME_TICKS, SUDDEN_DEATH_INTERVAL_TICKS, SUDDEN_DEATH_TICKS } from './constants';
import { bombAt, cellOf } from './round';
import { Bonus, DIRECTION_VECTORS, Tile, type Bomb, type Direction, type Player, type PlayerInput, type RoundState } from './types';

export type BotLevel = 'debutant' | 'pro' | 'expert';
export const BOT_LEVELS: readonly BotLevel[] = ['debutant', 'pro', 'expert'];
export const BOT_LEVEL_NAMES: Record<BotLevel, string> = { debutant: 'Débutant', pro: 'Professionnel', expert: 'Expert' };
/** Nom court, pour les étiquettes où la place manque. */
export const BOT_LEVEL_SHORT: Record<BotLevel, string> = { debutant: 'Débutant', pro: 'Pro', expert: 'Expert' };

interface Profile {
  /** Ticks entre deux réflexions (temps de réaction). */
  thinkEvery: number;
  /** Probabilité de ne pas voir le danger à une réflexion. */
  blindness: number;
  /** Probabilité de poser la bombe quand l'endroit s'y prête. */
  bombChance: number;
  /** Intérêt pour toucher un adversaire (0 : n'attaque pas exprès). */
  attack: number;
  /** Distance maximale (en cases) à laquelle un bonus attire. */
  bonusReach: number;
  /** Marge de sécurité (ticks) pour traverser une zone qui va exploser. */
  margin: number;
  /** Probabilité de flâner au hasard au lieu de suivre son plan. */
  wander: number;
  /** Se méfie des adversaires : ne s'arrête que là où une bombe posée par eux laisserait une issue. */
  cautious: boolean;
}

const PROFILES: Record<BotLevel, Profile> = {
  debutant: { thinkEvery: 16, blindness: 0.25, bombChance: 0.3, attack: 0, bonusReach: 4, margin: 20, wander: 0.3, cautious: false },
  pro: { thinkEvery: 6, blindness: 0.03, bombChance: 0.8, attack: 5, bonusReach: 10, margin: 12, wander: 0.05, cautious: false },
  expert: { thinkEvery: 3, blindness: 0, bombChance: 1, attack: 8, bonusReach: 99, margin: 10, wander: 0, cautious: true },
};

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const NEVER = Number.POSITIVE_INFINITY;
/** Une bombe télécommandée adverse peut partir à tout moment : on la croit proche d'exploser. */
const REMOTE_THREAT_TICKS = 40;

interface Danger {
  /** Tick (relatif) où une flamme atteindra la case ; NEVER si jamais. */
  at: Float64Array;
  /** Ticks pendant lesquels une flamme déjà présente reste sur la case. */
  burning: Float64Array;
}

/**
 * Cerveau d'un robot : lit l'état de la manche et choisit la commande du
 * joueur qu'il contrôle, comme le ferait un joueur humain (direction, bombe).
 * Trois niveaux : le débutant réagit tard et oublie parfois le danger,
 * l'expert réagit presque à chaque instant et chasse les adversaires.
 */
export class BotBrain {
  readonly level: BotLevel;
  private readonly profile: Profile;
  private readonly random: () => number;
  private cooldown = 0;
  private plan: { direction: Direction | null; target: number } = { direction: null, target: -1 };
  private lastX = 0;
  private lastY = 0;
  private stuckTicks = 0;

  constructor(level: BotLevel, random: () => number) {
    this.level = level;
    this.profile = PROFILES[level];
    this.random = random;
  }

  decide(state: RoundState, id: number): PlayerInput {
    const me = state.players[id];
    if (!me?.alive) return { direction: null, bomb: false };
    const moved = Math.abs(me.x - this.lastX) + Math.abs(me.y - this.lastY) > 0.001;
    this.stuckTicks = moved || !this.plan.direction ? 0 : this.stuckTicks + 1;
    this.lastX = me.x;
    this.lastY = me.y;

    let bomb = false;
    if (--this.cooldown <= 0 || this.stuckTicks > 20) {
      this.cooldown = this.profile.thinkEvery;
      bomb = this.think(state, me);
    }
    return { direction: this.steer(state, me), bomb };
  }

  // ---- Réflexion ----

  /** Choisit une destination ; renvoie vrai s'il faut poser une bombe maintenant. */
  private think(state: RoundState, me: Player): boolean {
    const here = index(state, ...cellOf(me));
    const danger = computeDanger(state, me.id);
    const stepTicks = Math.ceil(1 / me.speed);
    const inDanger = danger.at[here] !== NEVER || danger.burning[here] > 0;

    if (this.stuckTicks > 20) {
      this.stuckTicks = 0;
      this.plan.target = this.randomNeighbour(state, me, here, danger);
      return false;
    }

    if (inDanger) {
      // Distrait (débutant) : il ne voit pas le danger et poursuit son plan en cours.
      if (this.random() < this.profile.blindness) return false;
      this.plan.target = this.search(state, me, danger, stepTicks).nearestSafe;
      return false;
    }

    if (this.random() < this.profile.wander) {
      this.plan.target = this.randomNeighbour(state, me, here, danger);
      return false;
    }

    const reach = this.search(state, me, danger, stepTicks);
    const canBomb = state.bombs.filter((bomb) => bomb.owner === me.id).length < me.maxBombs;
    // Destinations possibles, les plus intéressantes d'abord.
    const candidates: Array<{ cell: number; score: number; bombWorth: boolean }> = [];
    for (const [cell, steps] of reach.distance) {
      if (danger.at[cell] !== NEVER || danger.burning[cell] > 0) continue;
      let score = -steps;
      const bonus = state.bonuses[cell];
      if (bonus !== Bonus.None && steps <= this.profile.bonusReach) score += 14;
      let bombWorth = false;
      if (canBomb) {
        const { blocks, enemies } = blastValue(state, cell, me);
        const gain = blocks * 4 + enemies * this.profile.attack;
        bombWorth = gain > 0;
        score += gain;
      }
      candidates.push({ cell, score, bombWorth });
    }
    candidates.sort((a, b) => b.score - a.score);

    // Un endroit où poser une bombe ne vaut que si l'on peut s'en abriter ensuite.
    let best = -1;
    let bombHere = false;
    let escape = -1;
    let checked = 0;
    let threatChecks = 0;
    for (const candidate of candidates) {
      if (this.profile.cautious && threatChecks++ < 12 && !this.survivesAmbush(state, me, candidate.cell, stepTicks)) continue;
      if (!candidate.bombWorth) {
        if (state.bonuses[candidate.cell] !== Bonus.None) {
          best = candidate.cell;
          break;
        }
        continue;
      }
      if (checked++ >= 6) break;
      const shelter = this.escapeAfterBomb(state, me, candidate.cell, stepTicks);
      if (shelter !== -1) {
        best = candidate.cell;
        bombHere = candidate.cell === here;
        escape = shelter;
        break;
      }
    }

    // Rien d'intéressant à portée : se rapprocher d'un adversaire.
    if (best === -1) best = this.towardEnemy(state, me, reach.distance, danger);
    this.plan.target = best === -1 ? here : best;
    if (bombHere && this.random() < this.profile.bombChance) {
      // La fuite est décidée en même temps que la bombe, quel que soit le niveau.
      this.plan.target = escape;
      return true;
    }
    return false;
  }

  /** Parcours en largeur des cases accessibles sans traverser une flamme au mauvais moment. */
  private search(state: RoundState, me: Player, danger: Danger, stepTicks: number) {
    const start = index(state, ...cellOf(me));
    const distance = new Map<number, number>([[start, 0]]);
    const queue = [start];
    let nearestSafe = -1;
    while (queue.length) {
      const cell = queue.shift()!;
      const steps = distance.get(cell)!;
      if (nearestSafe === -1 && danger.at[cell] === NEVER && danger.burning[cell] === 0) nearestSafe = cell;
      for (const direction of DIRECTIONS) {
        const [dx, dy] = DIRECTION_VECTORS[direction];
        const x = (cell % state.width) + dx;
        const y = Math.floor(cell / state.width) + dy;
        if (!walkable(state, x, y, me)) continue;
        const next = index(state, x, y);
        if (distance.has(next)) continue;
        const arrival = (steps + 1) * stepTicks;
        if (!passable(danger, next, arrival, stepTicks, this.profile.margin)) continue;
        distance.set(next, steps + 1);
        queue.push(next);
      }
    }
    return { distance, nearestSafe: nearestSafe === -1 ? start : nearestSafe };
  }

  /** Abri atteignable à temps si l'on pose une bombe sur cette case (-1 s'il n'y en a pas). */
  private escapeAfterBomb(state: RoundState, player: Player, cell: number, stepTicks: number): number {
    const cx = cell % state.width;
    const cy = Math.floor(cell / state.width);
    // On raisonne comme si l'on était déjà sur cette case.
    const me: Player = { ...player, x: cx + 0.5, y: cy + 0.5 };
    const fuse = BOMB_FUSE_TICKS;
    const hypothetical: Bomb = {
      id: -1,
      owner: me.id,
      cx,
      cy,
      fuse,
      range: me.range,
      passThrough: [me.id],
      remote: false,
      slide: null,
      slideProgress: 0,
    };
    const withBomb: RoundState = { ...state, bombs: [...state.bombs, hypothetical] };
    const danger = computeDanger(withBomb, me.id);
    const reach = this.search(withBomb, me, danger, stepTicks);
    const safe = reach.nearestSafe;
    if (safe === index(state, cx, cy)) return -1;
    const steps = reach.distance.get(safe) ?? NEVER;
    return steps * stepTicks + this.profile.margin < fuse ? safe : -1;
  }

  /**
   * Si chaque adversaire posait une bombe là où il se trouve, pourrait-on
   * encore, depuis cette case, se mettre à l'abri ? Évite de se faire enfermer.
   */
  private survivesAmbush(state: RoundState, player: Player, cell: number, stepTicks: number): boolean {
    const enemies = state.players.filter((other) => other.alive && other.id !== player.id);
    const ambush: Bomb[] = enemies.map((enemy, i) => {
      const [cx, cy] = cellOf(enemy);
      return { id: -2 - i, owner: enemy.id, cx, cy, fuse: BOMB_FUSE_TICKS, range: enemy.range, passThrough: [enemy.id], remote: false, slide: null, slideProgress: 0 };
    });
    const me: Player = { ...player, x: (cell % state.width) + 0.5, y: Math.floor(cell / state.width) + 0.5 };
    const hypothetical: RoundState = { ...state, bombs: [...state.bombs, ...ambush] };
    const danger = computeDanger(hypothetical, me.id);
    if (danger.at[cell] === NEVER) return true;
    const reach = this.search(hypothetical, me, danger, stepTicks);
    return reach.nearestSafe !== cell;
  }

  /** Case sûre la plus proche d'un adversaire (pour ne pas rester à attendre). */
  private towardEnemy(state: RoundState, me: Player, distance: Map<number, number>, danger: Danger): number {
    const enemies = state.players.filter((player) => player.alive && player.id !== me.id).map((enemy) => cellOf(enemy));
    if (!enemies.length) return -1;
    let best = -1;
    let bestScore = NEVER;
    for (const [cell, steps] of distance) {
      if (danger.at[cell] !== NEVER || danger.burning[cell] > 0) continue;
      const x = cell % state.width;
      const y = Math.floor(cell / state.width);
      const gap = Math.min(...enemies.map(([ex, ey]) => Math.abs(ex - x) + Math.abs(ey - y)));
      // Ni collé à l'adversaire (trop exposé), ni loin : à deux ou trois cases.
      const score = Math.abs(gap - 2) * 3 + steps;
      if (score < bestScore) {
        bestScore = score;
        best = cell;
      }
    }
    return best;
  }

  /** Case voisine au hasard, hors des zones qui vont exploser. */
  private randomNeighbour(state: RoundState, me: Player, here: number, danger: Danger): number {
    const options = DIRECTIONS.map((direction) => {
      const [dx, dy] = DIRECTION_VECTORS[direction];
      return [(here % state.width) + dx, Math.floor(here / state.width) + dy] as const;
    }).filter(([x, y]) => {
      const cell = index(state, x, y);
      return walkable(state, x, y, me) && danger.at[cell] === NEVER && danger.burning[cell] === 0;
    });
    if (!options.length) return here;
    const [x, y] = options[Math.floor(this.random() * options.length)];
    return index(state, x, y);
  }

  // ---- Déplacement ----

  /** Direction à tenir pour avancer vers la destination, case par case. */
  private steer(state: RoundState, me: Player): Direction | null {
    const target = this.plan.target;
    const [cx, cy] = cellOf(me);
    const here = index(state, cx, cy);
    if (target === -1) return null;
    let next = target;
    if (target !== here) {
      next = this.nextStep(state, me, here, target);
      if (next === -1) return null;
    }
    const tx = (next % state.width) + 0.5;
    const ty = Math.floor(next / state.width) + 0.5;
    const dx = tx - me.x;
    const dy = ty - me.y;
    // Arrivé au centre de la destination : on s'arrête.
    if (Math.abs(dx) < me.speed && Math.abs(dy) < me.speed) return null;
    const direction: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.plan.direction = direction;
    return direction;
  }

  /**
   * Première case du plus court chemin vers la destination, sans traverser de
   * flamme ni de case sur le point d'exploser.
   */
  private nextStep(state: RoundState, me: Player, from: number, to: number): number {
    const danger = computeDanger(state, me.id);
    const stepTicks = Math.ceil(1 / me.speed);
    const parent = new Map<number, number>([[from, -1]]);
    const depth = new Map<number, number>([[from, 0]]);
    const queue = [from];
    while (queue.length) {
      const cell = queue.shift()!;
      if (cell === to) break;
      for (const direction of DIRECTIONS) {
        const [dx, dy] = DIRECTION_VECTORS[direction];
        const x = (cell % state.width) + dx;
        const y = Math.floor(cell / state.width) + dy;
        if (!walkable(state, x, y, me)) continue;
        const next = index(state, x, y);
        if (parent.has(next)) continue;
        const steps = depth.get(cell)! + 1;
        if (!passable(danger, next, steps * stepTicks, stepTicks, this.profile.margin)) continue;
        parent.set(next, cell);
        depth.set(next, steps);
        queue.push(next);
      }
    }
    if (!parent.has(to)) return -1;
    let cell = to;
    while (parent.get(cell) !== from && parent.get(cell) !== -1) cell = parent.get(cell)!;
    return cell;
  }
}

function index(state: RoundState, x: number, y: number): number {
  return y * state.width + x;
}

function walkable(state: RoundState, x: number, y: number, me: Player): boolean {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false;
  const tile = state.tiles[index(state, x, y)];
  if (tile !== Tile.Floor && !(tile === Tile.Block && me.wallPass)) return false;
  const bomb = bombAt(state, x, y);
  return !bomb || bomb.passThrough.includes(me.id) || (me.bombPass && bomb.owner === me.id);
}

/** Traverser cette case à ce moment-là évite-t-il ses flammes ? */
function passable(danger: Danger, cell: number, arrival: number, stepTicks: number, margin: number): boolean {
  const burning = danger.burning[cell];
  if (burning > 0 && burning > arrival - margin) return false;
  const at = danger.at[cell];
  if (at === NEVER) return true;
  // Dangereux si l'on s'y trouve entre l'explosion et l'extinction de la flamme.
  return arrival + stepTicks + margin < at || arrival - margin > at + FLAME_TICKS;
}

/** Cases touchées par une bombe (elle-même comprise). */
function blastCells(state: RoundState, bomb: Pick<Bomb, 'cx' | 'cy' | 'range'>): number[] {
  const cells = [index(state, bomb.cx, bomb.cy)];
  for (const direction of DIRECTIONS) {
    const [dx, dy] = DIRECTION_VECTORS[direction];
    for (let distance = 1; distance <= bomb.range; distance++) {
      const x = bomb.cx + dx * distance;
      const y = bomb.cy + dy * distance;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) break;
      const cell = index(state, x, y);
      const tile = state.tiles[cell];
      if (tile === Tile.Wall || tile === Tile.Burning) break;
      cells.push(cell);
      if (tile === Tile.Block || state.bonuses[cell] !== Bonus.None || bombAt(state, x, y)) break;
    }
  }
  return cells;
}

/** Moment où chaque case sera atteinte par une explosion, réactions en chaîne comprises. */
function computeDanger(state: RoundState, me: number): Danger {
  const at = new Float64Array(state.tiles.length).fill(NEVER);
  const burning = new Float64Array(state.tiles.length);
  for (let cell = 0; cell < state.flames.length; cell++) burning[cell] = state.flames[cell];

  const times = state.bombs.map((bomb) => (bomb.remote && bomb.owner !== me ? Math.min(bomb.fuse, REMOTE_THREAT_TICKS) : bomb.fuse));
  const blasts = state.bombs.map((bomb) => blastCells(state, bomb));
  // Réactions en chaîne : une bombe touchée explose en même temps que celle qui la touche.
  let changed = true;
  while (changed) {
    changed = false;
    state.bombs.forEach((_, i) => {
      for (const cell of blasts[i]) {
        state.bombs.forEach((other, j) => {
          if (index(state, other.cx, other.cy) === cell && times[j] > times[i]) {
            times[j] = times[i];
            changed = true;
          }
        });
      }
    });
  }
  state.bombs.forEach((_, i) => {
    for (const cell of blasts[i]) at[cell] = Math.min(at[cell], times[i]);
  });
  markSuddenDeath(state, at);
  return { at, burning };
}

/** Cases qui vont se couvrir d'un mur pendant le resserrement de l'arène (connu du seul serveur). */
function markSuddenDeath(state: RoundState, at: Float64Array): void {
  const order = state.suddenDeathOrder;
  if (!order?.length || state.tick < SUDDEN_DEATH_TICKS - 5 * SUDDEN_DEATH_INTERVAL_TICKS) return;
  const elapsed = Math.max(0, state.tick - SUDDEN_DEATH_TICKS);
  let next = SUDDEN_DEATH_TICKS + Math.ceil(elapsed / SUDDEN_DEATH_INTERVAL_TICKS) * SUDDEN_DEATH_INTERVAL_TICKS;
  if (next <= state.tick) next += SUDDEN_DEATH_INTERVAL_TICKS;
  let upcoming = 0;
  for (let i = state.suddenDeathIndex; i < order.length && upcoming < 12; i++) {
    const cell = order[i];
    if (state.tiles[cell] === Tile.Wall) continue;
    at[cell] = Math.min(at[cell], next - state.tick);
    next += SUDDEN_DEATH_INTERVAL_TICKS;
    upcoming++;
  }
}

/** Ce qu'une bombe posée sur cette case toucherait : caisses et adversaires. */
function blastValue(state: RoundState, cell: number, me: Player): { blocks: number; enemies: number } {
  const bomb = { cx: cell % state.width, cy: Math.floor(cell / state.width), range: me.range };
  let blocks = 0;
  let enemies = 0;
  const cells = new Set(blastCells(state, bomb));
  for (const hit of cells) if (state.tiles[hit] === Tile.Block) blocks++;
  for (const player of state.players) {
    if (!player.alive || player.id === me.id) continue;
    if (cells.has(index(state, ...cellOf(player)))) enemies++;
  }
  return { blocks, enemies };
}
