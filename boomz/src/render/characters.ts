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

// D'après la planche de personnages (docs/personnages.jpg), dans l'ordre de
// `CHARACTERS` (game/powers.ts), qui décrit leurs pouvoirs.
export const PLAYER_LOOKS: PlayerLook[] = [
  { name: 'Boomer', cap: '#2447a8', capFront: '#f2efe6', ball: '#ffc928', suit: '#1f2f6b', trim: '#ffc928' },
  { name: 'Blaster', cap: '#d8342b', capFront: '#1d1d24', ball: '#ff9a1f', suit: '#1d1d24', trim: '#d8342b' },
  { name: 'Frost', cap: '#5fb7f0', capFront: '#ffffff', ball: '#dff3ff', suit: '#2f6fb5', trim: '#ffffff' },
  { name: 'Toxic', cap: '#4fb33a', capFront: '#2c3a22', ball: '#d7f23a', suit: '#2c3a22', trim: '#4fb33a' },
  { name: 'Boomette', cap: '#e85aa8', capFront: '#ffd3ea', ball: '#ff8cc6', suit: '#b83a7e', trim: '#ffd3ea' },
  { name: 'Omega', cap: '#c9d1dc', capFront: '#1d2a44', ball: '#48c6ff', suit: '#5a6478', trim: '#48c6ff' },
  { name: 'Rocket', cap: '#f2f4f8', capFront: '#1d3f8f', ball: '#ff8a1f', suit: '#2458c8', trim: '#ff8a1f' },
  { name: 'Rocco', cap: '#7c7f86', capFront: '#3b3d44', ball: '#a9adb5', suit: '#4a4c52', trim: '#5fb7f0' },
];

/** Couleur propre à chaque personnage : bouton de pouvoir et effets en partie. */
/** Couleur et nom de chaque équipe (parties en équipes). */
export const TEAM_COLORS: readonly string[] = ['#e8433a', '#3a8ee8'];
export const TEAM_NAMES: readonly string[] = ['Rouge', 'Bleue'];

export const HERO_COLORS: readonly string[] = ['#2447a8', '#c42a22', '#2f78c4', '#3a8a2b', '#b83a7e', '#3a78a8', '#d8640f', '#5f636c'];

/**
 * Apparences (cosmétiques de base, phase 4) : variantes de couleurs d'un même
 * personnage, sans aucun effet sur le jeu. Gratuites pour l'instant ; la
 * roadmap prévoit d'en faire la seule source de revenus, sans pay-to-win.
 */
export const SKIN_NAMES: readonly string[] = ['Classique', 'Nuit', 'Or'];

/** Apparence d'un personnage (voir `CHARACTERS`) avec l'une de ses variantes. */
export function lookFor(character: number, skin = 0): PlayerLook {
  const base = PLAYER_LOOKS[character % PLAYER_LOOKS.length];
  switch (skin) {
    case 1:
      // Nuit : tenue sombre, liserés aux couleurs du personnage.
      return { name: base.name, cap: '#1f2233', capFront: base.cap, ball: base.ball, suit: '#141622', trim: base.cap };
    case 2:
      // Or : casquette dorée, badge nacré.
      return { name: base.name, cap: '#d9a521', capFront: base.capFront, ball: '#fff1a8', suit: base.suit, trim: '#d9a521' };
    default:
      return base;
  }
}

const OUTLINE = '#15161f';
const SKIN = '#ffd9b3';

/**
 * Dessine un personnage en style chibi (grosse tête, casquette à badge),
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

  // Tête (sans pompon ni antenne au sommet : silhouette propre à Boomz).
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
export function drawAvatar(canvas: HTMLCanvasElement, character: number, skin = 0): void {
  const size = canvas.clientWidth || 32;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  drawCharacter(ctx, lookFor(character, skin), size / 2, size * 0.56, size * 0.4, 'down');
}
