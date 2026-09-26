import { BOMB_FUSE_TICKS, FLAME_TICKS, SUDDEN_DEATH_TICKS, TICK_RATE } from '../game/constants';
import type { MatchState } from '../game/match';
import { DIRECTION_VECTORS, Tile, type Bomb, type Player, type RoundState } from '../game/types';

export interface PlayerLook {
  name: string;
  /** Casquette ou casque. */
  cap: string;
  /** Panneau avant de la casquette. */
  capFront: string;
  /** Pompon au sommet et badge. */
  ball: string;
  /** Tenue. */
  suit: string;
  /** Liseré de la tenue. */
  trim: string;
}

// D'après la planche de personnages (docs/personnages.jpg). Seuls Boomer (01)
// et Blaster (03) jouent dans le prototype ; les pouvoirs viennent plus tard.
// Les places 3 à 6 reprennent déjà des couleurs de la planche.
export const PLAYER_LOOKS: PlayerLook[] = [
  { name: 'Boomer', cap: '#2447a8', capFront: '#f2efe6', ball: '#ffc928', suit: '#1f2f6b', trim: '#ffc928' },
  { name: 'Blaster', cap: '#d8342b', capFront: '#1d1d24', ball: '#ff9a1f', suit: '#1d1d24', trim: '#d8342b' },
  { name: 'Frost', cap: '#5fb7f0', capFront: '#ffffff', ball: '#dff3ff', suit: '#2f6fb5', trim: '#ffffff' },
  { name: 'Toxic', cap: '#4fb33a', capFront: '#2c3a22', ball: '#d7f23a', suit: '#2c3a22', trim: '#4fb33a' },
  { name: 'Boomette', cap: '#e85aa8', capFront: '#ffd3ea', ball: '#ff8cc6', suit: '#b83a7e', trim: '#ffd3ea' },
  { name: 'Omega', cap: '#c9d1dc', capFront: '#1d2a44', ball: '#48c6ff', suit: '#5a6478', trim: '#48c6ff' },
];

const COLORS = {
  floorA: '#8fce74',
  floorB: '#84c46a',
  wallTop: '#5b6478',
  wallSide: '#3d4455',
  blockTop: '#d49a5a',
  blockSide: '#9c6533',
  blockLine: '#b57b40',
  shadow: 'rgba(0, 0, 0, 0.22)',
};

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private cell = 32;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  /** Ajuste la résolution du canvas à sa taille affichée (écrans haute densité). */
  resize(width: number, height: number): void {
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
  }

  render(match: MatchState): void {
    const { ctx, canvas } = this;
    const round = match.round;
    this.cell = canvas.width / round.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.drawFloor(round);
    this.drawFlames(round);
    this.drawTiles(round);
    for (const bomb of round.bombs) this.drawBomb(bomb, round.tick);
    // La manche est figée une fois terminée : on poursuit l'animation des
    // éliminations avec l'horloge de la phase.
    const frozen = match.phase === 'roundOver' || match.phase === 'matchOver';
    const animationTick = round.tick + (frozen ? match.phaseTick : 0);
    const players = [...round.players].sort((a, b) => a.y - b.y);
    for (const player of players) this.drawPlayer(player, animationTick);
    this.drawSuddenDeathWarning(round);
  }

  private drawFloor(round: RoundState): void {
    const { ctx, cell } = this;
    for (let y = 0; y < round.height; y++) {
      for (let x = 0; x < round.width; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
      }
    }
  }

  private drawTiles(round: RoundState): void {
    const { ctx, cell } = this;
    const depth = cell * 0.18;
    for (let y = 0; y < round.height; y++) {
      for (let x = 0; x < round.width; x++) {
        const tile = round.tiles[y * round.width + x];
        if (tile === Tile.Floor) continue;
        const px = x * cell;
        const py = y * cell;
        if (tile === Tile.Wall) {
          ctx.fillStyle = COLORS.wallSide;
          ctx.fillRect(px, py, cell, cell);
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(px, py, cell, cell - depth);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(px, py, cell, cell * 0.08);
        } else {
          const burning = tile === Tile.Burning;
          const progress = burning ? 1 - round.flames[y * round.width + x] / FLAME_TICKS : 0;
          const inset = cell * (0.04 + progress * 0.3);
          const size = cell - inset * 2;
          ctx.globalAlpha = 1 - progress * 0.8;
          ctx.fillStyle = COLORS.shadow;
          ctx.fillRect(px + inset + depth * 0.4, py + inset + depth * 0.6, size, size);
          ctx.fillStyle = burning ? '#7a3b1c' : COLORS.blockSide;
          ctx.fillRect(px + inset, py + inset, size, size);
          ctx.fillStyle = burning ? '#c05a22' : COLORS.blockTop;
          ctx.fillRect(px + inset, py + inset, size, size - depth);
          ctx.strokeStyle = COLORS.blockLine;
          ctx.lineWidth = Math.max(1, cell * 0.05);
          ctx.strokeRect(px + inset + cell * 0.12, py + inset + cell * 0.1, size - cell * 0.24, size - depth - cell * 0.2);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  private drawFlames(round: RoundState): void {
    const { ctx, cell } = this;
    const flameAt = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < round.width && y < round.height && round.flames[y * round.width + x] > 0;
    for (let y = 0; y < round.height; y++) {
      for (let x = 0; x < round.width; x++) {
        const remaining = round.flames[y * round.width + x];
        if (remaining <= 0) continue;
        const life = remaining / FLAME_TICKS;
        const thickness = cell * (0.45 + 0.35 * Math.sin(life * Math.PI));
        const cx = x * cell + cell / 2;
        const cy = y * cell + cell / 2;
        const layers: Array<[string, number]> = [
          ['#ff5a1f', 1],
          ['#ffb52e', 0.66],
          ['#fff4b8', 0.33],
        ];
        for (const [color, scale] of layers) {
          const t = thickness * scale;
          ctx.fillStyle = color;
          // Tronçon horizontal et vertical, reliés aux flammes voisines.
          const left = flameAt(x - 1, y) ? x * cell : cx - t / 2;
          const right = flameAt(x + 1, y) ? (x + 1) * cell : cx + t / 2;
          const top = flameAt(x, y - 1) ? y * cell : cy - t / 2;
          const bottom = flameAt(x, y + 1) ? (y + 1) * cell : cy + t / 2;
          ctx.fillRect(left, cy - t / 2, right - left, t);
          ctx.fillRect(cx - t / 2, top, t, bottom - top);
          ctx.beginPath();
          ctx.arc(cx, cy, t / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawBomb(bomb: Bomb, tick: number): void {
    const { ctx, cell } = this;
    const cx = bomb.cx * cell + cell / 2;
    const cy = bomb.cy * cell + cell / 2;
    // Pulsation qui s'accélère à l'approche de l'explosion.
    const urgency = 1 - bomb.fuse / BOMB_FUSE_TICKS;
    const pulse = 1 + 0.08 * Math.sin(tick * (0.15 + urgency * 0.5));
    const radius = cell * 0.36 * pulse;

    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.8, radius * 0.9, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = urgency > 0.75 && Math.floor(tick / 4) % 2 === 0 ? '#5a1d1d' : '#1f2230';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.35, cy - radius * 0.35, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#6b5a3a';
    ctx.lineWidth = Math.max(1.5, cell * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.4, cy - radius * 0.8);
    ctx.quadraticCurveTo(cx + radius * 0.9, cy - radius * 1.3, cx + radius * 0.7, cy - radius * 1.5);
    ctx.stroke();
    ctx.fillStyle = tick % 6 < 3 ? '#ffe35c' : '#ff8a1f';
    ctx.beginPath();
    ctx.arc(cx + radius * 0.7, cy - radius * 1.5, cell * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayer(player: Player, tick: number): void {
    const { ctx, cell } = this;
    const look = PLAYER_LOOKS[player.id];
    let alpha = 1;
    let scale = 1;
    if (!player.alive) {
      const since = tick - (player.diedAt ?? tick);
      alpha = Math.max(0, 1 - since / 40);
      scale = 1 + since / 60;
      if (alpha <= 0) return;
    }
    const bob = player.moving && player.alive ? Math.abs(Math.sin(tick * 0.35)) * cell * 0.06 : 0;
    const cx = player.x * cell;
    const cy = player.y * cell - bob;
    const r = cell * 0.34 * scale;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(player.x * cell, player.y * cell + r * 0.85, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Corps (tenue et liseré), à demi caché sous la grosse tête.
    ctx.fillStyle = look.suit;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.62, r * 0.62, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.trim;
    ctx.fillRect(cx - r * 0.18, cy + r * 0.45, r * 0.36, r * 0.4);

    const headY = cy - r * 0.12;
    const headR = r * 0.72;
    // Visage
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    const [fx, fy] = DIRECTION_VECTORS[player.facing];
    const facingUp = player.facing === 'up';

    // Pompon au sommet.
    ctx.fillStyle = look.ball;
    ctx.beginPath();
    ctx.arc(cx, headY - headR * 1.08, headR * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Casquette : calotte, panneau avant, badge et visière orientée vers le regard.
    ctx.fillStyle = look.cap;
    ctx.beginPath();
    ctx.arc(cx, headY - headR * 0.05, headR * 1.02, Math.PI, 0);
    ctx.fill();
    if (!facingUp) {
      ctx.fillStyle = look.capFront;
      ctx.beginPath();
      ctx.arc(cx + fx * headR * 0.2, headY - headR * 0.05, headR * 0.62, Math.PI * 1.08, Math.PI * 1.92);
      ctx.fill();
      ctx.fillStyle = look.ball;
      ctx.beginPath();
      ctx.arc(cx + fx * headR * 0.35, headY - headR * 0.5, headR * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.cap;
      ctx.beginPath();
      ctx.ellipse(cx + fx * headR * 0.55, headY - headR * 0.02, headR * (fx === 0 ? 0.95 : 0.7), headR * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Grands yeux ovales, avec un reflet.
      const ex = fx * headR * 0.28;
      const ey = headR * 0.32 + fy * headR * 0.08;
      for (const side of [-1, 1]) {
        if (fx !== 0 && side === -fx) continue; // de profil, un seul œil visible
        const x = cx + side * headR * (fx === 0 ? 0.32 : 0.18) + ex;
        ctx.fillStyle = '#15161f';
        ctx.beginPath();
        ctx.ellipse(x, headY + ey, headR * 0.15, headR * 0.27, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x - headR * 0.04, headY + ey - headR * 0.1, headR * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // De dos : la casquette couvre toute la tête.
      ctx.beginPath();
      ctx.arc(cx, headY, headR * 1.02, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSuddenDeathWarning(round: RoundState): void {
    const remaining = SUDDEN_DEATH_TICKS - round.tick;
    if (remaining > 5 * TICK_RATE || remaining < 0) return;
    const { ctx, canvas } = this;
    if (Math.floor(round.tick / 15) % 2 === 0) {
      ctx.strokeStyle = 'rgba(255, 60, 40, 0.8)';
      ctx.lineWidth = this.cell * 0.2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }
  }
}
