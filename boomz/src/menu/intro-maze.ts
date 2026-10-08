import { CHARACTER_COUNT } from '../game/powers';
import { drawCharacter, lookFor, type PlayerLook } from '../render/characters';
import { drawBomb, IMG_H, IMG_W, IntroScene, type Place } from './intro-base';

/** BOOMZ en grosses cases : X = caisse qui cache une lettre. */
const FONT: Record<string, string[]> = {
  B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  O: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X'],
  Z: ['XXX', '..X', '.X.', 'X..', 'XXX'],
};
const WORD = 'BOOMZ';
/** Grille : une rangée de murs, cinq rangées de lettres, le couloir, une rangée de murs. */
const COLS = 23;
const ROWS = 8;
const CORRIDOR = 6;

const FUSE_S = 0.5;
/** Délai de propagation du feu d'une case à la suivante. */
const SPREAD_S = 0.055;
const FLAME_S = 0.35;
/** Fin : la grille s'efface et le vrai titre prend sa place. */
const MORPH_S = 0.6;
const HOLD_S = 0.45;

const Cell = { Floor: 0, Wall: 1, Crate: 2 } as const;
type Cell = (typeof Cell)[keyof typeof Cell];

interface Bomb {
  letter: number;
  col: number;
  lit: number;
  blown: boolean;
}

/**
 * « La poursuite » : vu de haut, deux personnages se courent après dans un
 * couloir du labyrinthe. Le poursuivant pose des bombes ; le feu remonte dans
 * les caisses et dessine, case par case, les lettres de BOOMZ.
 */
export class MazeIntro extends IntroScene {
  private readonly grid: Cell[][] = [];
  /** Lettre (0 à 4) cachée sous chaque case, ou -1. */
  private readonly letterAt: number[][] = [];
  /** Moment où chaque case a pris feu (`null` : intacte). */
  private readonly burnAt: Array<Array<number | null>> = [];
  private readonly centers: number[] = [];
  private readonly bombs: Bomb[] = [];
  private readonly prey: PlayerLook;
  private chaserX = 0;
  private phase = 0;
  private lastBurn: number | null = null;
  private started = false;

  constructor(...args: ConstructorParameters<typeof IntroScene>) {
    super(...args);
    for (let row = 0; row < ROWS; row++) {
      this.grid.push(Array.from({ length: COLS }, () => Cell.Floor));
      this.letterAt.push(Array.from({ length: COLS }, () => -1));
      this.burnAt.push(Array.from({ length: COLS }, () => null));
    }
    for (let col = 0; col < COLS; col++) {
      this.grid[0][col] = Cell.Wall;
      this.grid[ROWS - 1][col] = Cell.Wall;
    }
    for (let row = 1; row < CORRIDOR; row++) {
      this.grid[row][0] = Cell.Wall;
      this.grid[row][COLS - 1] = Cell.Wall;
      for (let col = 1; col < COLS - 1; col++) this.grid[row][col] = Cell.Crate;
    }
    let left = 1;
    for (const [letter, char] of [...WORD].entries()) {
      const shape = FONT[char];
      for (const [row, line] of shape.entries()) {
        for (const [col, mark] of [...line].entries()) if (mark === 'X') this.letterAt[row + 1][left + col] = letter;
      }
      this.centers.push(left + (shape[0].length - 1) / 2);
      left += shape[0].length + 1;
    }
    // Le fuyard : un autre personnage que celui du joueur, qui le poursuit.
    let prey = lookFor(Math.floor(Math.random() * CHARACTER_COUNT));
    for (let i = 0; prey.name === this.options.look.name && i < 10; i++) prey = lookFor(Math.floor(Math.random() * CHARACTER_COUNT));
    this.prey = prey;
  }

  /** Taille d'une case et coin de la grille, centrée sur le titre de l'accueil. */
  private layout(place: Place): { cell: number; left: number; top: number } {
    const cell = Math.min(26, (place.width - 16) / COLS);
    const cx = place.x + (IMG_W * place.scale) / 2;
    const cy = place.y + (IMG_H * place.scale) / 2;
    return { cell, left: cx - (COLS * cell) / 2, top: cy - (ROWS * cell) / 2 };
  }

  protected update(dt: number, place: Place): void {
    const { cell, left } = this.layout(place);
    if (!this.started) {
      this.started = true;
      this.chaserX = -cell * 2.5;
    }
    this.chaserX += Math.max(240, (COLS * cell) / 1.35) * dt;
    this.phase += dt * 16;

    const next = this.bombs.length;
    const nextX = left + (this.centers[next] + 0.5) * cell;
    if (next < WORD.length && this.chaserX >= nextX) {
      this.bombs.push({ letter: next, col: Math.round(this.centers[next]), lit: this.clock, blown: false });
      this.options.sound({ kind: 'bombPlaced', mine: true });
      this.options.haptic({ kind: 'impact', style: 'light', intensity: 0.5 });
    }

    for (const bomb of this.bombs) {
      if (bomb.blown || this.clock - bomb.lit < FUSE_S) continue;
      bomb.blown = true;
      const last = bomb.letter === WORD.length - 1;
      this.shake(last ? 8 : 4, 0.22);
      this.options.sound({ kind: 'explosion', count: last ? 2 : 1 });
      this.options.haptic({ kind: 'impact', style: last ? 'heavy' : 'medium', intensity: 0.8 });
      // La flamme court dans le couloir et allume les caisses-lettres juste au-dessus…
      for (let col = bomb.col - 2; col <= bomb.col + 2; col++) {
        if (col < 0 || col >= COLS) continue;
        this.burnAt[CORRIDOR][col] = this.clock;
        if (this.letterAt[CORRIDOR - 1][col] === bomb.letter) this.ignite(bomb.letter, CORRIDOR - 1, col, this.clock + 0.05);
      }
    }

    if (this.bombs.length === WORD.length && this.bombs.every((bomb) => bomb.blown) && this.lastBurn === null) {
      this.lastBurn = Math.max(...this.burnAt.flat().map((at) => at ?? 0));
    }
    if (this.lastBurn !== null && this.clock > this.lastBurn + FLAME_S + MORPH_S + HOLD_S) this.leave();
  }

  /** …et le feu se propage de caisse en caisse dans toute la lettre. */
  private ignite(letter: number, startRow: number, startCol: number, at: number): void {
    const queue: Array<[number, number, number]> = [[startRow, startCol, at]];
    while (queue.length) {
      const [row, col, time] = queue.shift()!;
      const known = this.burnAt[row][col];
      if (known !== null && known <= time) continue;
      this.burnAt[row][col] = time;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          const c = col + dc;
          if ((dr || dc) && this.letterAt[r]?.[c] === letter) queue.push([r, c, time + SPREAD_S]);
        }
      }
    }
  }

  protected drawScene(ctx: CanvasRenderingContext2D, place: Place): void {
    const morph = this.lastBurn === null ? 0 : Math.min(1, Math.max(0, (this.clock - this.lastBurn - FLAME_S) / MORPH_S));
    this.drawEmber(ctx, place, 0.3 + morph * 0.7);
    const { cell, left, top } = this.layout(place);

    ctx.globalAlpha = 1 - morph;
    this.drawGrid(ctx, cell, left, top);
    const ground = top + (CORRIDOR + 0.5) * cell;
    for (const bomb of this.bombs) {
      if (!bomb.blown) drawBomb(ctx, left + (bomb.col + 0.5) * cell, ground + cell * 0.3, cell * 0.36, this.clock - bomb.lit, FUSE_S);
    }
    this.drawRunners(ctx, cell, ground);
    ctx.globalAlpha = 1;

    // Le vrai titre prend la place des lettres de feu.
    if (morph > 0) this.drawTitle(ctx, place, morph, 1.12 - 0.12 * morph, (1 - morph) * 0.8);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, cell: number, left: number, top: number): void {
    const alpha = ctx.globalAlpha;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = left + col * cell;
        const y = top + row * cell;
        const kind = this.grid[row][col];
        const burn = this.burnAt[row][col];
        const burning = burn !== null && this.clock >= burn;
        const age = burning ? this.clock - burn : 0;
        // Sol (aussi sous les caisses qui ont brûlé).
        ctx.fillStyle = (row + col) % 2 ? '#241b18' : '#2a201c';
        ctx.fillRect(x, y, cell, cell);
        if (kind === Cell.Wall) {
          ctx.fillStyle = '#4a4240';
          ctx.fillRect(x, y, cell, cell);
          ctx.fillStyle = '#5d5452';
          ctx.fillRect(x, y, cell, cell * 0.22);
          ctx.strokeStyle = '#2b2523';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          continue;
        }
        const letter = this.letterAt[row][col] >= 0;
        if (kind === Cell.Crate && !(letter && burning)) this.drawCrate(ctx, x, y, cell);
        // Lettre brûlée : de la lave qui palpite.
        if (letter && burning) {
          const pulse = 0.85 + 0.15 * Math.sin(this.clock * 9 + row + col * 0.7);
          const lava = ctx.createLinearGradient(x, y, x, y + cell);
          lava.addColorStop(0, `rgba(255, 214, 90, ${pulse})`);
          lava.addColorStop(1, `rgba(236, 84, 20, ${pulse})`);
          ctx.fillStyle = lava;
          ctx.fillRect(x - 0.5, y - 0.5, cell + 1, cell + 1);
        }
        // Flamme au moment où la case prend feu.
        if (burning && age < FLAME_S) {
          const t = age / FLAME_S;
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255, 236, 160, ${(1 - t) * alpha})`;
          const grow = cell * 0.2 * (1 - t);
          ctx.fillRect(x - grow, y - grow, cell + grow * 2, cell + grow * 2);
          ctx.globalCompositeOperation = 'source-over';
          // Éclats de la caisse.
          if (kind === Cell.Crate) {
            ctx.fillStyle = '#8a5424';
            for (let i = 0; i < 4; i++) {
              const angle = (i / 4) * Math.PI * 2 + row;
              ctx.fillRect(x + cell / 2 + Math.cos(angle) * cell * t * 1.2, y + cell / 2 + Math.sin(angle) * cell * t * 1.2, cell * 0.18, cell * 0.18);
            }
          }
        }
      }
    }
  }

  private drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number): void {
    const inset = cell * 0.06;
    ctx.fillStyle = '#a0652b';
    ctx.fillRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2);
    ctx.strokeStyle = '#6b3f17';
    ctx.lineWidth = Math.max(1, cell * 0.08);
    ctx.strokeRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2);
    ctx.beginPath();
    ctx.moveTo(x + inset * 2, y + inset * 2);
    ctx.lineTo(x + cell - inset * 2, y + cell - inset * 2);
    ctx.moveTo(x + cell - inset * 2, y + inset * 2);
    ctx.lineTo(x + inset * 2, y + cell - inset * 2);
    ctx.stroke();
  }

  private drawRunners(ctx: CanvasRenderingContext2D, cell: number, ground: number): void {
    const r = cell * 0.5;
    const runners: Array<[PlayerLook, number]> = [
      [this.prey, this.chaserX + cell * 1.8],
      [this.options.look, this.chaserX],
    ];
    for (const [i, [look, x]] of runners.entries()) {
      const bob = Math.abs(Math.sin(this.phase + i * 1.3)) * r * 0.2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(x, ground + r * 0.8, r * 0.7, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCharacter(ctx, look, x, ground - bob, r, 'right');
    }
  }
}
