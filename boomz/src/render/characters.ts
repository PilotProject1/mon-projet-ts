import { DIRECTION_VECTORS, type Direction } from '../game/types';

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

// D'après la planche de personnages (docs/personnages.jpg), dans l'ordre des
// places du salon. Les pouvoirs ne sont pas encore actifs.
export const PLAYER_LOOKS: PlayerLook[] = [
  { name: 'Boomer', cap: '#2447a8', capFront: '#f2efe6', ball: '#ffc928', suit: '#1f2f6b', trim: '#ffc928' },
  { name: 'Blaster', cap: '#d8342b', capFront: '#1d1d24', ball: '#ff9a1f', suit: '#1d1d24', trim: '#d8342b' },
  { name: 'Frost', cap: '#5fb7f0', capFront: '#ffffff', ball: '#dff3ff', suit: '#2f6fb5', trim: '#ffffff' },
  { name: 'Toxic', cap: '#4fb33a', capFront: '#2c3a22', ball: '#d7f23a', suit: '#2c3a22', trim: '#4fb33a' },
  { name: 'Boomette', cap: '#e85aa8', capFront: '#ffd3ea', ball: '#ff8cc6', suit: '#b83a7e', trim: '#ffd3ea' },
  { name: 'Omega', cap: '#c9d1dc', capFront: '#1d2a44', ball: '#48c6ff', suit: '#5a6478', trim: '#48c6ff' },
];

const OUTLINE = '#15161f';
const SKIN = '#ffd9b3';

/**
 * Dessine un personnage en style chibi (grosse tête, casquette, pompon),
 * centré en (cx, cy), `r` étant le rayon de la silhouette.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  look: PlayerLook,
  cx: number,
  cy: number,
  r: number,
  facing: Direction,
): void {
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.strokeStyle = OUTLINE;
  const shape = (fill: string, path: () => void) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    path();
    ctx.fill();
    ctx.stroke();
  };

  // Corps (tenue et liseré), à demi caché sous la grosse tête.
  shape(look.suit, () => ctx.ellipse(cx, cy + r * 0.62, r * 0.6, r * 0.42, 0, 0, Math.PI * 2));
  ctx.fillStyle = look.trim;
  ctx.fillRect(cx - r * 0.16, cy + r * 0.42, r * 0.32, r * 0.42);

  const headY = cy - r * 0.12;
  const headR = r * 0.72;
  const [fx, fy] = DIRECTION_VECTORS[facing];

  // Pompon au sommet, puis tête.
  shape(look.ball, () => ctx.arc(cx, headY - headR * 1.08, headR * 0.28, 0, Math.PI * 2));
  shape(facing === 'up' ? look.cap : SKIN, () => ctx.arc(cx, headY, headR, 0, Math.PI * 2));
  if (facing === 'up') return;

  // Casquette : calotte, panneau avant, badge et visière orientée vers le regard.
  shape(look.cap, () => ctx.arc(cx, headY - headR * 0.05, headR * 1.02, Math.PI, 0));
  ctx.fillStyle = look.capFront;
  ctx.beginPath();
  ctx.arc(cx + fx * headR * 0.2, headY - headR * 0.05, headR * 0.62, Math.PI * 1.08, Math.PI * 1.92);
  ctx.fill();
  shape(look.ball, () => ctx.arc(cx + fx * headR * 0.35, headY - headR * 0.52, headR * 0.16, 0, Math.PI * 2));
  shape(look.cap, () =>
    ctx.ellipse(cx + fx * headR * 0.55, headY - headR * 0.02, headR * (fx === 0 ? 0.95 : 0.7), headR * 0.15, 0, 0, Math.PI * 2),
  );

  // Grands yeux ovales, avec un reflet.
  const ex = fx * headR * 0.28;
  const ey = headR * 0.34 + fy * headR * 0.08;
  for (const side of [-1, 1]) {
    if (fx !== 0 && side === -fx) continue; // de profil, un seul œil visible
    const x = cx + side * headR * (fx === 0 ? 0.32 : 0.18) + ex;
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(x, headY + ey, headR * 0.15, headR * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - headR * 0.04, headY + ey - headR * 0.1, headR * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Portrait d'un personnage, pour le salon et le tableau des scores. */
export function drawAvatar(canvas: HTMLCanvasElement, lookIndex: number): void {
  const size = canvas.clientWidth || 32;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  drawCharacter(ctx, PLAYER_LOOKS[lookIndex % PLAYER_LOOKS.length], size / 2, size * 0.56, size * 0.4, 'down');
}
