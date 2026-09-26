import { Bonus } from '../game/types';

export interface BonusInfo {
  name: string;
  effect: string;
  color: string;
}

export const BONUS_INFO: Record<Exclude<Bonus, 0>, BonusInfo> = {
  [Bonus.Flame]: { name: 'Flamme+', effect: 'Explosions plus longues', color: '#ff7a2a' },
  [Bonus.Bomb]: { name: 'Bombe+', effect: 'Une bombe de plus à la fois', color: '#5b6cff' },
  [Bonus.Speed]: { name: 'Vitesse+', effect: 'Déplacement plus rapide', color: '#1fb87a' },
  [Bonus.Vest]: { name: 'Gilet pare-flamme', effect: 'Encaisse une explosion', color: '#2aa7d8' },
  [Bonus.Detonator]: { name: 'Détonateur', effect: 'Vos bombes explosent sur commande', color: '#d8372b' },
  [Bonus.WallPass]: { name: 'Traverse-mur', effect: 'Passe à travers les caisses', color: '#9b6a3d' },
  [Bonus.BombPass]: { name: 'Traverse-bombe', effect: 'Passe sur ses propres bombes', color: '#7a4fd6' },
  [Bonus.Kick]: { name: 'Kick', effect: 'Pousse aussi les bombes des autres', color: '#e2a51a' },
};

export const BONUS_ORDER: Array<Exclude<Bonus, 0>> = [
  Bonus.Flame,
  Bonus.Bomb,
  Bonus.Speed,
  Bonus.Vest,
  Bonus.Detonator,
  Bonus.WallPass,
  Bonus.BombPass,
  Bonus.Kick,
];

const INK = '#ffffff';
const DARK = '#15161f';

/** Pastille d'un bonus : fond coloré arrondi et pictogramme blanc, centrée en (cx, cy). */
export function drawBonusIcon(ctx: CanvasRenderingContext2D, bonus: Bonus, cx: number, cy: number, size: number): void {
  if (bonus === Bonus.None) return;
  const info = BONUS_INFO[bonus];
  const half = size / 2;
  const radius = size * 0.22;
  ctx.save();
  ctx.fillStyle = info.color;
  ctx.strokeStyle = DARK;
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.roundRect(cx - half, cy - half, size, size, radius);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.roundRect(cx - half + size * 0.08, cy - half + size * 0.08, size * 0.84, size * 0.3, radius * 0.7);
  ctx.fill();

  const u = size / 10;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, u * 0.9);
  ctx.beginPath();
  switch (bonus) {
    case Bonus.Flame:
      ctx.moveTo(cx, cy - 3.6 * u);
      ctx.bezierCurveTo(cx + 3.4 * u, cy - 0.6 * u, cx + 3 * u, cy + 3.4 * u, cx, cy + 3.4 * u);
      ctx.bezierCurveTo(cx - 3 * u, cy + 3.4 * u, cx - 3.2 * u, cy, cx - 1 * u, cy - 1.4 * u);
      ctx.bezierCurveTo(cx - 0.8 * u, cy - 0.2 * u, cx, cy - 0.8 * u, cx, cy - 3.6 * u);
      ctx.fill();
      break;
    case Bonus.Bomb:
      ctx.arc(cx - 0.4 * u, cy + 0.8 * u, 2.6 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 1.4 * u, cy - 1.2 * u);
      ctx.quadraticCurveTo(cx + 2.6 * u, cy - 3.2 * u, cx + 3.4 * u, cy - 3 * u);
      ctx.stroke();
      break;
    case Bonus.Speed:
      ctx.moveTo(cx + 1 * u, cy - 4 * u);
      ctx.lineTo(cx - 2.6 * u, cy + 0.6 * u);
      ctx.lineTo(cx - 0.2 * u, cy + 0.6 * u);
      ctx.lineTo(cx - 1 * u, cy + 4 * u);
      ctx.lineTo(cx + 2.6 * u, cy - 0.8 * u);
      ctx.lineTo(cx + 0.2 * u, cy - 0.8 * u);
      ctx.closePath();
      ctx.fill();
      break;
    case Bonus.Vest:
      ctx.moveTo(cx, cy - 3.6 * u);
      ctx.lineTo(cx + 3 * u, cy - 2.4 * u);
      ctx.quadraticCurveTo(cx + 3 * u, cy + 2 * u, cx, cy + 3.8 * u);
      ctx.quadraticCurveTo(cx - 3 * u, cy + 2 * u, cx - 3 * u, cy - 2.4 * u);
      ctx.closePath();
      ctx.fill();
      break;
    case Bonus.Detonator:
      ctx.roundRect(cx - 2.2 * u, cy - 1.2 * u, 4.4 * u, 5 * u, u * 0.8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 1.2 * u, cy - 1.2 * u);
      ctx.lineTo(cx + 2.4 * u, cy - 4 * u);
      ctx.stroke();
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(cx, cy + 1 * u, 1.2 * u, 0, Math.PI * 2);
      ctx.fill();
      break;
    case Bonus.WallPass:
      // Briques traversées par une flèche.
      ctx.globalAlpha = 0.55;
      ctx.fillRect(cx - 3.4 * u, cy - 2.6 * u, 3 * u, 2.2 * u);
      ctx.fillRect(cx - 3.4 * u, cy + 0.2 * u, 1.4 * u, 2.2 * u);
      ctx.fillRect(cx - 1.6 * u, cy + 0.2 * u, 3 * u, 2.2 * u);
      ctx.globalAlpha = 1;
      drawArrow(ctx, cx - 1 * u, cx + 3.8 * u, cy - 0.2 * u, u);
      break;
    case Bonus.BombPass:
      ctx.globalAlpha = 0.55;
      ctx.arc(cx - 1.2 * u, cy + 0.4 * u, 2.4 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      drawArrow(ctx, cx - 3.6 * u, cx + 3.8 * u, cy + 0.4 * u, u);
      break;
    case Bonus.Kick:
      // Botte.
      ctx.moveTo(cx - 2.2 * u, cy - 3.6 * u);
      ctx.lineTo(cx + 0.4 * u, cy - 3.6 * u);
      ctx.lineTo(cx + 0.4 * u, cy + 0.4 * u);
      ctx.lineTo(cx + 3.4 * u, cy + 1.2 * u);
      ctx.lineTo(cx + 3.4 * u, cy + 3.4 * u);
      ctx.lineTo(cx - 2.2 * u, cy + 3.4 * u);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, fromX: number, toX: number, y: number, u: number): void {
  ctx.beginPath();
  ctx.moveTo(fromX, y);
  ctx.lineTo(toX - 0.4 * u, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toX, y);
  ctx.lineTo(toX - 2 * u, y - 1.6 * u);
  ctx.lineTo(toX - 2 * u, y + 1.6 * u);
  ctx.closePath();
  ctx.fill();
}

/** Icône d'un bonus dans un petit canvas de la page (légende, état du joueur). */
export function paintBonusCanvas(canvas: HTMLCanvasElement, bonus: Bonus): void {
  const size = canvas.clientWidth || 24;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  drawBonusIcon(ctx, bonus, size / 2, size / 2, size * 0.92);
}
