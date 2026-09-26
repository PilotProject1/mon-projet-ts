import { drawCharacter, type PlayerLook } from './characters';
import type { Direction } from '../game/types';

/** Durée d'un cycle de la danse (ms). */
const DANCE_MS = 2400;
const CONFETTI_COUNT = 90;

interface Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  color: string;
}

/** Phrases lancées par le gagnant à la figure des autres. */
const TAUNTS = [
  'Trop facile !',
  'Qui veut une revanche ?',
  'Boum ! Au suivant !',
  'Même pas transpiré.',
  'C’était ça, votre stratégie ?',
  'Je suis inarrêtable !',
  'Rentrez chez vous !',
];
const ROBOT_TAUNTS = ['Bip boup… victoire !', 'Calcul terminé : vous avez perdu.', 'Les robots gagnent toujours.'];

export function pickTaunt(robot: boolean, random: () => number = Math.random): string {
  const list = robot ? ROBOT_TAUNTS : TAUNTS;
  return list[Math.floor(random() * list.length)];
}

/**
 * Fin de match : le personnage du gagnant danse sous une pluie de confettis
 * à ses couleurs (sauts, pirouettes, déhanché), pour narguer les autres.
 */
export class VictoryDance {
  private readonly stage: HTMLCanvasElement;
  private readonly sky: HTMLCanvasElement;
  private look: PlayerLook | null = null;
  private confetti: Confetto[] = [];
  private start = 0;
  private frame: number | null = null;
  private readonly still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(stage: HTMLCanvasElement, sky: HTMLCanvasElement) {
    this.stage = stage;
    this.sky = sky;
  }

  play(look: PlayerLook): void {
    this.stop();
    this.look = look;
    this.start = performance.now();
    const colors = [look.cap, look.ball, look.trim, look.suit, '#ffcf33', '#ffffff'];
    this.confetti = Array.from({ length: this.still ? 0 : CONFETTI_COUNT }, () => this.newConfetto(colors, true));
    const loop = (now: number) => {
      this.draw(now);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.look = null;
  }

  private newConfetto(colors: string[], anywhere: boolean): Confetto {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() * -1 : -0.05,
      vx: (Math.random() - 0.5) * 0.0015,
      vy: 0.0025 + Math.random() * 0.003,
      size: 5 + Math.random() * 6,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  }

  private fit(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (!width || !height) return null;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx?.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    return ctx;
  }

  private draw(now: number): void {
    const look = this.look;
    if (!look) return;
    const t = this.still ? 0 : ((now - this.start) % DANCE_MS) / DANCE_MS;

    const sky = this.fit(this.sky);
    if (sky) {
      const w = this.sky.clientWidth;
      const h = this.sky.clientHeight;
      const colors = [look.cap, look.ball, look.trim, look.suit, '#ffcf33', '#ffffff'];
      for (const [i, piece] of this.confetti.entries()) {
        piece.x += piece.vx + Math.sin(now / 500 + i) * 0.0004;
        piece.y += piece.vy;
        piece.angle += piece.spin;
        if (piece.y > 1.05) this.confetti[i] = this.newConfetto(colors, false);
        sky.save();
        sky.translate(piece.x * w, piece.y * h);
        sky.rotate(piece.angle);
        sky.fillStyle = piece.color;
        sky.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        sky.restore();
      }
    }

    const ctx = this.fit(this.stage);
    if (!ctx) return;
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    const r = Math.min(w, h) * 0.3;
    // Chorégraphie : deux sauts de joie, une pirouette, puis un déhanché.
    let hop = 0;
    let tilt = 0;
    let squash = 1;
    let facing: Direction = 'down';
    if (t < 0.4) {
      const phase = (t / 0.4) * 2;
      const jump = Math.sin((phase % 1) * Math.PI);
      hop = jump * r * 0.9;
      squash = 1 + (jump < 0.15 ? 0.12 : -0.05);
    } else if (t < 0.65) {
      const spin: Direction[] = ['down', 'left', 'up', 'right', 'down', 'left', 'up', 'right'];
      facing = spin[Math.floor(((t - 0.4) / 0.25) * spin.length) % spin.length];
      hop = Math.sin(((t - 0.4) / 0.25) * Math.PI) * r * 0.4;
    } else {
      const sway = Math.sin(((t - 0.65) / 0.35) * Math.PI * 4);
      tilt = sway * 0.28;
      hop = Math.abs(sway) * r * 0.15;
    }

    const groundY = h * 0.84;
    // Ombre au sol, qui rétrécit quand il saute.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(w / 2, groundY, r * (0.8 - hop / (r * 3)), r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(w / 2, groundY - hop);
    ctx.rotate(tilt);
    ctx.scale(1 / squash, squash);
    drawCharacter(ctx, look, 0, -r * 1.05, r, facing);
    ctx.restore();
  }
}
