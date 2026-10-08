import type { Haptic } from '../audio/haptics';
import type { SoundEvent } from '../audio/events';
import { drawCharacter, type PlayerLook } from '../render/characters';

/** Dimensions du titre détouré (`public/title-boomz.png`). */
const IMG_W = 490;
const IMG_H = 301;
/**
 * Séparations entre les lettres B·O·O·M·Z dans l'image, mesurées à mi-hauteur
 * (y = 150). Les lettres penchent vers la droite : chaque séparation suit la
 * même inclinaison (`LEAN` pixels vers la droite par pixel vers le haut).
 */
const CUTS = [-60, 128, 208, 288, 378, 560];
const CUT_Y = 150;
const LEAN = 0.22;
/** Ligne où court le personnage, juste sous le pied des lettres (y dans l'image). */
const RUN_Y = 246;

const FUSE_S = 0.5;
const BLAST_S = 0.55;
/** Après la dernière explosion : le titre complet s'embrase, puis l'intro s'efface. */
const HOLD_S = 0.85;
const FADE_S = 0.45;

interface Bomb {
  letter: number;
  x: number;
  lit: number;
  blown: boolean;
}

interface Blast {
  letter: number;
  x: number;
  at: number;
  sparks: Array<{ vx: number; vy: number; size: number }>;
}

export interface IntroOptions {
  /** Personnage du joueur : c'est lui qui traverse l'écran. */
  look: PlayerLook;
  /** Le titre de l'accueil : l'intro le reconstitue exactement à sa place. */
  logo: HTMLElement;
  sound: (event: SoundEvent) => void;
  haptic: (haptic: Haptic) => void;
}

/**
 * Intro au lancement : le personnage du joueur traverse l'écran en lâchant
 * cinq bombes, et chaque explosion fait apparaître une lettre de BOOMZ, à
 * l'endroit exact où le titre de l'accueil se trouve. L'intro s'efface
 * ensuite sur l'accueil. Un toucher la passe.
 *
 * La promesse se résout quand l'accueil commence à apparaître (musique et
 * fond animé peuvent alors démarrer).
 */
export function playIntro(options: IntroOptions): Promise<void> {
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (still) return Promise.resolve();
  return new Promise((resolve) => new Intro(options, resolve).start());
}

class Intro {
  private readonly canvas = document.createElement('canvas');
  private readonly title = new Image();
  private readonly bombs: Bomb[] = [];
  private readonly blasts: Blast[] = [];
  private readonly revealed = [false, false, false, false, false];
  private clock = 0;
  private last = 0;
  private runnerX = -40;
  private runnerPhase = 0;
  private finishedAt: number | null = null;
  private fading = false;
  private frame: number | null = null;
  private shakeUntil = 0;
  private shakePower = 0;

  private readonly options: IntroOptions;
  private readonly done: () => void;

  constructor(options: IntroOptions, done: () => void) {
    this.options = options;
    this.done = done;
  }

  start(): void {
    const style = this.canvas.style;
    style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;z-index:1000;background:#120e0d;touch-action:none;' +
      `transition:opacity ${FADE_S}s ease-out;`;
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.append(this.canvas);
    // Un toucher passe l'intro.
    this.canvas.addEventListener('pointerdown', () => this.leave(0.25));
    // Titre introuvable ou trop long à charger : pas d'intro plutôt qu'un écran vide.
    const giveUp = window.setTimeout(() => this.leave(0.2), 1500);
    this.title.onload = () => {
      window.clearTimeout(giveUp);
      if (this.fading) return;
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.loop);
    };
    this.title.onerror = () => this.leave(0.2);
    this.title.src = '/title-boomz.png?v=3';
  }

  private readonly loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
  };

  /** Rectangle du titre de l'accueil, à l'écran (centré par défaut s'il est masqué). */
  private place(): { x: number; y: number; scale: number; width: number; height: number } {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const rect = this.options.logo.getBoundingClientRect();
    if (rect.width > 40) return { x: rect.left, y: rect.top, scale: rect.width / IMG_W, width, height };
    const w = Math.min(width * 0.92, 400);
    return { x: (width - w) / 2, y: height * 0.38 - (w * IMG_H) / IMG_W / 2, scale: w / IMG_W, width, height };
  }

  /** Abscisse (image) de la séparation `i` à la hauteur `y` (image). */
  private cut(i: number, y: number): number {
    return CUTS[i] + (CUT_Y - y) * LEAN;
  }

  /** Abscisse (écran) où tombe la bombe de la lettre `i`. */
  private bombX(i: number): number {
    const { x, scale } = this.place();
    return x + ((this.cut(i, RUN_Y) + this.cut(i + 1, RUN_Y)) / 2) * scale;
  }

  private speed(): number {
    const { width, scale } = this.place();
    // Le titre se traverse en un peu plus d'une seconde, quelle que soit la taille d'écran.
    return Math.max(260, width / 2.6, 330 * scale);
  }

  private update(dt: number): void {
    this.clock += dt;
    if (this.fading) return;
    const { width } = this.place();
    this.runnerX += this.speed() * dt;
    this.runnerPhase += dt * 16;

    const next = this.bombs.length;
    if (next < 5 && this.runnerX >= this.bombX(next)) {
      this.bombs.push({ letter: next, x: this.bombX(next), lit: this.clock, blown: false });
      this.options.sound({ kind: 'bombPlaced', mine: true });
      this.options.haptic({ kind: 'impact', style: 'light', intensity: 0.5 });
    }

    for (const bomb of this.bombs) {
      if (bomb.blown || this.clock - bomb.lit < FUSE_S) continue;
      bomb.blown = true;
      this.revealed[bomb.letter] = true;
      const last = bomb.letter === 4;
      this.blasts.push({
        letter: bomb.letter,
        x: bomb.x,
        at: this.clock,
        sparks: Array.from({ length: last ? 30 : 18 }, () => ({
          vx: (Math.random() - 0.5) * 320,
          vy: -80 - Math.random() * 260,
          size: 2 + Math.random() * 2.5,
        })),
      });
      this.shakeUntil = this.clock + (last ? 0.4 : 0.22);
      this.shakePower = last ? 9 : 5;
      this.options.sound({ kind: 'explosion', count: last ? 3 : 1 });
      this.options.haptic({ kind: 'impact', style: last ? 'heavy' : 'medium', intensity: last ? 1 : 0.8 });
      if (last) this.finishedAt = this.clock;
    }

    if (this.finishedAt !== null && this.clock - this.finishedAt > HOLD_S && this.runnerX > width + 30) this.leave(FADE_S);
  }

  /** Efface l'intro sur l'accueil (en `seconds`). */
  private leave(seconds: number): void {
    if (this.fading) return;
    this.fading = true;
    this.canvas.style.transition = `opacity ${seconds}s ease-out`;
    this.canvas.style.opacity = '0';
    this.canvas.style.pointerEvents = 'none';
    this.done();
    window.setTimeout(() => {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.canvas.remove();
    }, seconds * 1000 + 50);
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const { x, y, scale, width, height } = this.place();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(height * ratio)) {
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#120e0d';
    ctx.fillRect(0, 0, width, height);

    // Lueur de braise derrière le titre, qui grandit avec les lettres révélées.
    const lit = this.revealed.filter(Boolean).length;
    const cx = x + (IMG_W * scale) / 2;
    const cy = y + (IMG_H * scale) / 2;
    const glowR = Math.max(width, height) * 0.7;
    const ember = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    ember.addColorStop(0, `rgba(150, 45, 12, ${0.18 + lit * 0.06})`);
    ember.addColorStop(1, 'rgba(18, 14, 13, 0)');
    ctx.fillStyle = ember;
    ctx.fillRect(0, 0, width, height);

    const shaking = this.clock < this.shakeUntil;
    const sx = shaking ? (Math.random() - 0.5) * this.shakePower : 0;
    const sy = shaking ? (Math.random() - 0.5) * this.shakePower : 0;
    ctx.translate(sx, sy);

    const ground = y + RUN_Y * scale;
    this.drawLetters(ctx, x, y, scale);
    this.drawBombs(ctx, ground, scale);
    this.drawRunner(ctx, ground, scale);
    this.drawBlasts(ctx, x, y, ground, scale);

    // Fin : le titre complet s'embrase d'un coup.
    if (this.finishedAt !== null) {
      const t = (this.clock - this.finishedAt) / HOLD_S;
      if (t < 1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 * Math.sin(Math.min(1, t * 1.6) * Math.PI);
        ctx.drawImage(this.title, x, y, IMG_W * scale, IMG_H * scale);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  /** Chaque lettre révélée surgit un peu plus grande, puis se pose à sa place. */
  private drawLetters(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    for (let i = 0; i < 5; i++) {
      if (!this.revealed[i]) continue;
      const blast = this.blasts.find((b) => b.letter === i);
      const age = blast ? this.clock - blast.at : 1;
      const pop = age < 0.3 ? 1 + 0.28 * Math.pow(1 - age / 0.3, 2) : 1;
      // Point d'ancrage du grossissement : le centre de la lettre.
      const ax = x + ((this.cut(i, CUT_Y) + this.cut(i + 1, CUT_Y)) / 2) * scale;
      const ay = y + CUT_Y * scale;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.scale(pop, pop);
      ctx.translate(-ax, -ay);
      ctx.beginPath();
      ctx.moveTo(x + this.cut(i, 0) * scale, y);
      ctx.lineTo(x + this.cut(i + 1, 0) * scale, y);
      ctx.lineTo(x + this.cut(i + 1, IMG_H) * scale, y + IMG_H * scale);
      ctx.lineTo(x + this.cut(i, IMG_H) * scale, y + IMG_H * scale);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(this.title, x, y, IMG_W * scale, IMG_H * scale);
      // Encore chauffée à blanc juste après l'explosion.
      if (age < 0.45) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8 * (1 - age / 0.45);
        ctx.drawImage(this.title, x, y, IMG_W * scale, IMG_H * scale);
      }
      ctx.restore();
    }
  }

  private drawBombs(ctx: CanvasRenderingContext2D, ground: number, scale: number): void {
    const r = Math.max(7, 15 * scale);
    for (const bomb of this.bombs) {
      if (bomb.blown) continue;
      const age = this.clock - bomb.lit;
      // La bombe gonfle à l'approche de l'explosion.
      const swell = 1 + 0.18 * Math.max(0, Math.sin(age * 22)) * (age / FUSE_S);
      const by = ground - r * swell;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(bomb.x, ground, r * 0.9, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e4262b';
      ctx.strokeStyle = '#6e0d10';
      ctx.lineWidth = Math.max(1.5, r * 0.18);
      ctx.beginPath();
      ctx.arc(bomb.x, by, r * swell, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(bomb.x - r * 0.35, by - r * 0.35, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2a22';
      ctx.lineWidth = Math.max(1.2, r * 0.16);
      ctx.beginPath();
      ctx.moveTo(bomb.x + r * 0.5, by - r * 0.85);
      ctx.lineTo(bomb.x + r * 0.7, by - r * 1.25);
      ctx.stroke();
      const blink = Math.floor(age * 14) % 2 === 0;
      ctx.fillStyle = blink ? '#fff3a0' : '#ff8a1f';
      ctx.beginPath();
      ctx.arc(bomb.x + r * 0.72, by - r * 1.3, r * (blink ? 0.4 : 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRunner(ctx: CanvasRenderingContext2D, ground: number, scale: number): void {
    const r = Math.max(14, 30 * scale);
    if (this.runnerX > window.innerWidth + r * 2) return;
    const bob = Math.abs(Math.sin(this.runnerPhase)) * r * 0.22;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(this.runnerX, ground, r * 0.7, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCharacter(ctx, this.options.look, this.runnerX, ground - r * 1.04 - bob, r, 'right');
  }

  private drawBlasts(ctx: CanvasRenderingContext2D, x: number, y: number, ground: number, scale: number): void {
    for (const blast of this.blasts) {
      const age = this.clock - blast.at;
      const t = age / BLAST_S;
      if (t < 1) {
        // Le souffle part de la bombe et monte envelopper la lettre.
        const lx = x + ((this.cut(blast.letter, CUT_Y) + this.cut(blast.letter + 1, CUT_Y)) / 2) * scale;
        const ly = y + CUT_Y * scale;
        const bx = blast.x + (lx - blast.x) * Math.min(1, t * 2);
        const by = ground + (ly - ground) * Math.min(1, t * 2);
        const radius = (60 + 90 * t) * scale + 20;
        const glow = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
        glow.addColorStop(0, `rgba(255, 246, 190, ${0.95 * (1 - t)})`);
        glow.addColorStop(0.35, `rgba(255, 150, 40, ${0.75 * (1 - t)})`);
        glow.addColorStop(1, 'rgba(255, 70, 10, 0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      const life = 1.1;
      if (age > life) continue;
      ctx.fillStyle = `rgba(255, 190, 70, ${1 - age / life})`;
      for (const spark of blast.sparks) {
        const s = spark.size * Math.max(0.6, scale);
        ctx.fillRect(blast.x + spark.vx * age * scale, ground - 6 + spark.vy * age * scale + 420 * age * age * scale, s, s);
      }
    }
  }
}
