import { CHARACTER_COUNT } from '../game/powers';
import { drawCharacter, lookFor, type PlayerLook } from '../render/characters';

/** Taille d'un personnage (rayon de la silhouette, en pixels CSS). */
const R = 11;
/** Hauteur de la bande où courent les personnages, au-dessus de la phrase. */
const BAND = 44;
const FUSE_S = 1.3;
const BLAST_S = 0.45;

interface Runner {
  x: number;
  look: PlayerLook;
  speed: number;
  /** Phase de la course (balancement). */
  phase: number;
  /** Petit saut quand une explosion le surprend. */
  hopUntil: number;
  /** Prochaine bombe posée (secondes, horloge de la scène). */
  nextBomb: number;
}

interface Bomb {
  x: number;
  lit: number;
}

interface Blast {
  x: number;
  at: number;
  sparks: Array<{ vx: number; vy: number }>;
}

/**
 * Sur l'accueil, des personnages se courent après en marchant sur la phrase
 * d'accroche : ils se posent des bombes, sortent de l'écran, reviennent,
 * changent de sens. Purement décoratif (aucun effet sur le jeu).
 */
export class TaglineChase {
  private readonly canvas: HTMLCanvasElement;
  private readonly ground: HTMLElement;
  private readonly still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private runners: Runner[] = [];
  private bombs: Bomb[] = [];
  private blasts: Blast[] = [];
  private dir = 1;
  private clock = 0;
  /** Pause entre deux passages (secondes restantes). */
  private rest = 0.6;
  private last = 0;
  private frame: number | null = null;
  private width = 0;

  /** `ground` : l'élément sur lequel ils courent (la phrase d'accroche). */
  constructor(canvas: HTMLCanvasElement, ground: HTMLElement) {
    this.canvas = canvas;
    this.ground = ground;
  }

  start(): void {
    if (this.still || this.frame !== null) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (document.hidden) return;
      this.place();
      this.update(dt);
      this.draw();
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  /** La bande couvre la largeur de l'écran, posée sur le haut de la phrase. */
  private place(): void {
    const parent = this.canvas.offsetParent as HTMLElement | null;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const text = this.ground.getBoundingClientRect();
    // Accueil en colonnes (paysage) : la piste reste dans la colonne du titre,
    // sinon elle couvre tout l'écran, d'un bord à l'autre.
    const viewport = document.documentElement.clientWidth;
    const column = parentRect.width < viewport * 0.7;
    const width = column ? parentRect.width : viewport;
    const style = this.canvas.style;
    style.left = `${column ? 0 : -parentRect.left}px`;
    style.width = `${width}px`;
    style.top = `${text.top - parentRect.top - BAND + 6}px`;
    style.height = `${BAND}px`;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(BAND * ratio)) {
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(BAND * ratio);
    }
    this.width = width;
  }

  /** Nouveau passage : un fuyard et un ou deux poursuivants, d'un côté ou de l'autre. */
  private newScene(): void {
    this.dir = Math.random() < 0.5 ? 1 : -1;
    const count = Math.random() < 0.55 ? 2 : 3;
    const cast = new Set<number>();
    while (cast.size < count) cast.add(Math.floor(Math.random() * CHARACTER_COUNT));
    const speed = 95 + Math.random() * 45;
    const start = this.dir > 0 ? -30 : this.width + 30;
    this.runners = [...cast].map((character, i) => ({
      x: start - this.dir * i * (34 + Math.random() * 18),
      look: lookFor(character, Math.random() < 0.2 ? 1 + Math.floor(Math.random() * 2) : 0),
      speed,
      phase: Math.random() * 6,
      hopUntil: 0,
      nextBomb: this.clock + 0.8 + Math.random() * 1.6,
    }));
  }

  private update(dt: number): void {
    this.clock += dt;
    if (!this.runners.length) {
      this.rest -= dt;
      if (this.rest <= 0) this.newScene();
    }
    for (const [i, runner] of this.runners.entries()) {
      // Les poursuivants se rapprochent puis se laissent distancer.
      const surge = i === 0 ? 0 : Math.sin(this.clock * 2.3 + i) * 18;
      runner.x += this.dir * (runner.speed + surge) * dt;
      runner.phase += dt * 14;
      // Les poursuivants posent des bombes derrière eux, sous le nez du fuyard qui revient.
      if (i > 0 && this.clock >= runner.nextBomb && runner.x > 10 && runner.x < this.width - 10) {
        this.bombs.push({ x: runner.x, lit: this.clock });
        runner.nextBomb = this.clock + 1.2 + Math.random() * 2;
      }
    }
    // Demi-tour surprise au milieu de l'écran.
    const lead = this.runners[0];
    if (lead && Math.random() < dt * 0.25 && lead.x > this.width * 0.3 && lead.x < this.width * 0.7) this.turn();

    for (const bomb of [...this.bombs]) {
      if (this.clock - bomb.lit < FUSE_S) continue;
      this.bombs = this.bombs.filter((other) => other !== bomb);
      this.blasts.push({
        x: bomb.x,
        at: this.clock,
        sparks: Array.from({ length: 10 }, () => ({ vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 110 })),
      });
      // Ceux qui passent dessus sautent de surprise.
      for (const runner of this.runners) if (Math.abs(runner.x - bomb.x) < 40) runner.hopUntil = this.clock + 0.4;
    }
    this.blasts = this.blasts.filter((blast) => this.clock - blast.at < BLAST_S + 0.4);

    // Tous sortis de l'écran : ils reviennent parfois en sens inverse, sinon pause.
    const gone = this.runners.length > 0 && this.runners.every((runner) => (this.dir > 0 ? runner.x > this.width + 40 : runner.x < -40));
    if (gone) {
      if (Math.random() < 0.4) this.turn();
      else {
        this.runners = [];
        this.rest = 0.8 + Math.random() * 2.2;
      }
    }
  }

  /** Changement de sens : le fuyard devient le dernier, les rôles s'inversent. */
  private turn(): void {
    this.dir = -this.dir;
    this.runners.reverse();
    for (const runner of this.runners) runner.nextBomb = this.clock + 0.6 + Math.random() * 1.4;
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const ratio = this.canvas.width / Math.max(1, this.width);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.width, BAND);
    const ground = BAND - 4;

    for (const bomb of this.bombs) {
      const blink = Math.floor((this.clock - bomb.lit) * 8) % 2 === 0;
      ctx.fillStyle = '#16171e';
      ctx.strokeStyle = '#0c0d12';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bomb.x, ground - 6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = blink ? '#fff3a0' : '#ff8a1f';
      ctx.beginPath();
      ctx.arc(bomb.x + 4, ground - 13, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const runner of this.runners) {
      const hop = runner.hopUntil > this.clock ? Math.sin(((runner.hopUntil - this.clock) / 0.4) * Math.PI) * 10 : 0;
      const bob = Math.abs(Math.sin(runner.phase)) * 2.5;
      const cy = ground - R * 1.04 - bob - hop;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(runner.x, ground, R * 0.7, R * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCharacter(ctx, runner.look, runner.x, cy, R, this.dir > 0 ? 'right' : 'left');
    }

    for (const blast of this.blasts) {
      const t = (this.clock - blast.at) / BLAST_S;
      if (t < 1) {
        const glow = ctx.createRadialGradient(blast.x, ground - 8, 0, blast.x, ground - 8, 26 * (0.5 + t));
        glow.addColorStop(0, `rgba(255, 243, 160, ${1 - t})`);
        glow.addColorStop(0.5, `rgba(255, 138, 31, ${0.8 * (1 - t)})`);
        glow.addColorStop(1, 'rgba(255, 90, 20, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(blast.x, ground - 8, 26 * (0.5 + t), 0, Math.PI * 2);
        ctx.fill();
      }
      const age = this.clock - blast.at;
      ctx.fillStyle = `rgba(255, 180, 60, ${Math.max(0, 1 - age / (BLAST_S + 0.4))})`;
      for (const spark of blast.sparks) {
        ctx.fillRect(blast.x + spark.vx * age, ground - 8 + spark.vy * age + 220 * age * age, 2.5, 2.5);
      }
    }
  }
}
