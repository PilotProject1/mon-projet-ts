import { Accessory } from '../game/accessories';
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
  /** Accessoire porté (voir `ACCESSORIES`) ; absent : aucun. */
  accessory?: number;
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

/** Couleur et nom de chaque équipe (parties en équipes). */
export const TEAM_COLORS: readonly string[] = ['#e8433a', '#3a8ee8'];
export const TEAM_NAMES: readonly string[] = ['Rouge', 'Bleue'];

/** Couleur propre à chaque personnage : bouton de pouvoir et effets en partie. */
export const HERO_COLORS: readonly string[] = ['#2447a8', '#c42a22', '#2f78c4', '#3a8a2b', '#b83a7e', '#3a78a8', '#d8640f', '#5f636c'];

/**
 * Apparences (cosmétiques de base, phase 4) : variantes de couleurs d'un même
 * personnage, sans aucun effet sur le jeu. Gratuites pour l'instant ; la
 * roadmap prévoit d'en faire la seule source de revenus, sans pay-to-win.
 */
export const SKIN_NAMES: readonly string[] = ['Classique', 'Nuit', 'Or'];

/** Apparence d'un personnage (voir `CHARACTERS`) avec l'une de ses variantes et un accessoire. */
export function lookFor(character: number, skin = 0, accessory = 0): PlayerLook {
  const look = colorsFor(character, skin);
  return accessory ? { ...look, accessory } : look;
}

function colorsFor(character: number, skin: number): PlayerLook {
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
  if (facing === 'up') {
    drawAccessory(ctx, look.accessory ?? Accessory.None, cx, cy, r, headY, headR, 0, -1, true);
    return;
  }

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
  drawAccessory(ctx, look.accessory ?? Accessory.None, cx, cy, r, headY, headR, fx, fy, false);
}

/**
 * Accessoire par-dessus le personnage. `back` : vu de dos (seuls ceux qui se
 * voient de dos sont dessinés) ; `fx` non nul : de profil.
 */
function drawAccessory(
  ctx: CanvasRenderingContext2D,
  accessory: number,
  cx: number,
  cy: number,
  r: number,
  headY: number,
  headR: number,
  fx: number,
  fy: number,
  back: boolean,
): void {
  if (!accessory) return;
  const line = Math.max(1, r * 0.09);
  ctx.lineWidth = line;
  ctx.strokeStyle = OUTLINE;
  const fillStroke = (fill: string) => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };
  // Yeux visibles (comme dans `drawCharacter`) : pour les lunettes et le cache-œil.
  const eyes = (fx === 0 ? [-1, 1] : [fx]).map((side) => ({
    x: cx + side * headR * (fx === 0 ? 0.32 : 0.18) + fx * headR * 0.28,
    y: headY + headR * 0.34 + fy * headR * 0.08,
    side,
  }));
  switch (accessory) {
    case Accessory.Sunglasses: {
      if (back) return;
      for (const eye of eyes) {
        ctx.beginPath();
        ctx.ellipse(eye.x, eye.y, headR * 0.24, headR * 0.19, 0, 0, Math.PI * 2);
        fillStroke('#15161f');
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(eye.x - headR * 0.08, eye.y - headR * 0.06, headR * 0.07, headR * 0.04, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      if (fx === 0) {
        ctx.moveTo(eyes[0].x + headR * 0.22, eyes[0].y - headR * 0.04);
        ctx.lineTo(eyes[1].x - headR * 0.22, eyes[1].y - headR * 0.04);
      } else {
        // Branche vers l'oreille, de profil.
        ctx.moveTo(eyes[0].x - fx * headR * 0.22, eyes[0].y - headR * 0.04);
        ctx.lineTo(cx - fx * headR * 0.45, eyes[0].y - headR * 0.1);
      }
      ctx.stroke();
      return;
    }
    case Accessory.BowTie: {
      if (back) return;
      // Sous le menton, sur la tenue.
      const x = cx + fx * r * 0.12;
      const y = cy + r * 0.7;
      const w = r * (fx === 0 ? 0.3 : 0.18);
      const h = r * 0.17;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - w, y - h);
      ctx.lineTo(x - w, y + h);
      ctx.closePath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y - h);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      fillStroke('#e8433a');
      ctx.beginPath();
      ctx.arc(x, y, r * 0.08, 0, Math.PI * 2);
      fillStroke('#b3261e');
      return;
    }
    case Accessory.Moustache: {
      if (back) return;
      const x = cx + fx * headR * 0.42;
      const y = headY + headR * 0.66 + fy * headR * 0.05;
      const w = headR * (fx === 0 ? 0.36 : 0.24);
      ctx.beginPath();
      for (const side of fx === 0 ? [-1, 1] : [fx]) {
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + side * w * 0.9, y - headR * 0.16, x + side * w * 1.5, y + headR * 0.04);
        ctx.quadraticCurveTo(x + side * w * 0.8, y + headR * 0.12, x, y + headR * 0.05);
      }
      fillStroke('#5a3a22');
      return;
    }
    case Accessory.EyePatch: {
      if (back) return;
      const eye = eyes.find((candidate) => candidate.side === 1) ?? eyes[0];
      ctx.beginPath();
      ctx.moveTo(eye.x - headR * 0.3, eye.y - headR * 0.42);
      ctx.lineTo(eye.x + headR * 0.34, eye.y + headR * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, headR * 0.22, headR * 0.26, 0, 0, Math.PI * 2);
      fillStroke('#15161f');
      return;
    }
    case Accessory.Scarf: {
      // Autour du cou, juste sous le menton.
      const y = cy + r * 0.64;
      ctx.beginPath();
      ctx.ellipse(cx, y, r * 0.6, r * 0.15, 0, 0, Math.PI * 2);
      fillStroke('#d8342b');
      // Pan qui tombe sur le côté.
      const side = fx === 0 ? 1 : -fx;
      ctx.beginPath();
      ctx.rect(cx + side * r * 0.3 - r * 0.1, y, r * 0.2, r * 0.36);
      fillStroke('#d8342b');
      ctx.fillStyle = '#ffd3ea';
      ctx.fillRect(cx + side * r * 0.3 - r * 0.1, y + r * 0.18, r * 0.2, r * 0.06);
      return;
    }
    case Accessory.Headphones: {
      ctx.lineWidth = r * 0.11;
      ctx.strokeStyle = '#26283a';
      ctx.beginPath();
      ctx.arc(cx, headY - headR * 0.02, headR * 1.1, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      ctx.lineWidth = line;
      ctx.strokeStyle = OUTLINE;
      const cups = fx === 0 ? [-1, 1] : [-fx * 0.15];
      for (const side of cups) {
        ctx.beginPath();
        ctx.ellipse(cx + side * headR * 1.02, headY + headR * 0.12, r * 0.15, r * 0.22, 0, 0, Math.PI * 2);
        fillStroke('#e8433a');
      }
      return;
    }
    case Accessory.Crown: {
      const w = headR * 1.15;
      const base = headY - headR * 0.88;
      const h = headR * 0.7;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, base);
      ctx.lineTo(cx - w / 2, base - h * 0.6);
      ctx.lineTo(cx - w / 4, base - h * 0.25);
      ctx.lineTo(cx, base - h);
      ctx.lineTo(cx + w / 4, base - h * 0.25);
      ctx.lineTo(cx + w / 2, base - h * 0.6);
      ctx.lineTo(cx + w / 2, base);
      ctx.closePath();
      fillStroke('#ffc928');
      ctx.beginPath();
      ctx.arc(cx, base - h * 0.28, headR * 0.08, 0, Math.PI * 2);
      fillStroke('#e8433a');
      return;
    }
  }
}

/** Portrait d'un personnage, pour le salon et le tableau des scores. */
export function drawAvatar(canvas: HTMLCanvasElement, character: number, skin = 0, accessory = 0): void {
  const size = canvas.clientWidth || 32;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  drawCharacter(ctx, lookFor(character, skin, accessory), size / 2, size * 0.56, size * 0.4, 'down');
}
