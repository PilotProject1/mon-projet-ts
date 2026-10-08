import type { Haptic } from '../audio/haptics';
import type { SoundEvent } from '../audio/events';
import type { PlayerLook } from '../render/characters';

/** Dimensions du titre détouré (`public/title-boomz.png`). */
export const IMG_W = 490;
export const IMG_H = 301;
const FADE_S = 0.45;
const BG = '#120e0d';

export interface IntroOptions {
  /** Personnage du joueur : c'est lui qui joue dans l'intro. */
  look: PlayerLook;
  /** Le titre de l'accueil : l'intro le reconstitue exactement à sa place. */
  logo: HTMLElement;
  sound: (event: SoundEvent) => void;
  haptic: (haptic: Haptic) => void;
}

/** Position du titre de l'accueil à l'écran, et taille de l'écran. */
export interface Place {
  x: number;
  y: number;
  /** Échelle du titre (largeur affichée / largeur de l'image). */
  scale: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/**
 * Socle commun des intros : un calque plein écran par-dessus l'accueil, qui
 * s'efface à la fin (ou au premier toucher) en laissant le titre de l'accueil
 * exactement là où l'intro l'a fait apparaître.
 */
export abstract class IntroScene {
  protected readonly options: IntroOptions;
  protected title!: HTMLImageElement;
  protected clock = 0;
  /** Fond plein (`false` : l'accueil se voit là où la scène ne dessine rien). */
  protected opaque = true;
  private readonly canvas = document.createElement('canvas');
  private readonly done: () => void;
  private last = 0;
  private fading = false;
  private frame: number | null = null;
  private shakeUntil = 0;
  private shakePower = 0;

  constructor(options: IntroOptions, done: () => void) {
    this.options = options;
    this.done = done;
  }

  /** Images supplémentaires à charger avant de commencer. */
  protected images(): string[] {
    return [];
  }

  /** Images supplémentaires chargées, dans l'ordre de `images()`. */
  protected loaded: HTMLImageElement[] = [];

  protected abstract update(dt: number, place: Place): void;
  protected abstract drawScene(ctx: CanvasRenderingContext2D, place: Place): void;

  start(): void {
    this.canvas.style.cssText = `position:fixed;inset:0;width:100%;height:100%;z-index:1000;background:${BG};touch-action:none;`;
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.append(this.canvas);
    // Un toucher passe l'intro.
    this.canvas.addEventListener('pointerdown', () => this.leave(0.25));
    // Images introuvables ou trop longues à charger : pas d'intro plutôt qu'un écran vide.
    const giveUp = window.setTimeout(() => this.leave(0.2), 1500);
    Promise.all(['/title-boomz.png?v=3', ...this.images()].map(loadImage)).then(
      ([title, ...rest]) => {
        window.clearTimeout(giveUp);
        if (this.fading) return;
        this.title = title;
        this.loaded = rest;
        this.last = performance.now();
        this.frame = requestAnimationFrame(this.loop);
      },
      () => this.leave(0.2),
    );
  }

  private readonly loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const place = this.place();
    if (!this.fading) {
      this.clock += dt;
      this.update(dt, place);
    }
    this.draw(place);
  };

  /** Rectangle du titre de l'accueil, à l'écran (centré par défaut s'il est masqué). */
  private place(): Place {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const rect = this.options.logo.getBoundingClientRect();
    if (rect.width > 40) return { x: rect.left, y: rect.top, scale: rect.width / IMG_W, width, height };
    const w = Math.min(width * 0.92, 400);
    return { x: (width - w) / 2, y: height * 0.38 - (w * IMG_H) / IMG_W / 2, scale: w / IMG_W, width, height };
  }

  protected shake(power: number, seconds: number): void {
    this.shakePower = power;
    this.shakeUntil = this.clock + seconds;
  }

  /** Efface l'intro sur l'accueil (en `seconds`). */
  protected leave(seconds = FADE_S): void {
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

  /** Le titre complet à sa place, avec un surcroît de lumière (`heat`, 0 à 1). */
  protected drawTitle(ctx: CanvasRenderingContext2D, place: Place, alpha = 1, zoom = 1, heat = 0): void {
    const w = IMG_W * place.scale * zoom;
    const h = IMG_H * place.scale * zoom;
    const cx = place.x + (IMG_W * place.scale) / 2;
    const cy = place.y + (IMG_H * place.scale) / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.title, cx - w / 2, cy - h / 2, w, h);
    if (heat > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * heat;
      ctx.drawImage(this.title, cx - w / 2, cy - h / 2, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  /** Lueur de braise derrière le titre (`strength` de 0 à 1). */
  protected drawEmber(ctx: CanvasRenderingContext2D, place: Place, strength: number): void {
    const cx = place.x + (IMG_W * place.scale) / 2;
    const cy = place.y + (IMG_H * place.scale) / 2;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(place.width, place.height) * 0.7);
    glow.addColorStop(0, `rgba(150, 45, 12, ${0.18 + strength * 0.3})`);
    glow.addColorStop(1, 'rgba(18, 14, 13, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, place.width, place.height);
  }

  private draw(place: Place): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(place.width * ratio) || this.canvas.height !== Math.round(place.height * ratio)) {
      this.canvas.width = Math.round(place.width * ratio);
      this.canvas.height = Math.round(place.height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.canvas.style.background = this.opaque ? BG : 'transparent';
    if (this.opaque) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, place.width, place.height);
    } else {
      ctx.clearRect(0, 0, place.width, place.height);
    }
    if (this.clock < this.shakeUntil) {
      ctx.translate((Math.random() - 0.5) * this.shakePower, (Math.random() - 0.5) * this.shakePower);
    }
    this.drawScene(ctx, place);
  }
}

/** Petits éclats de feu projetés par une explosion. */
export interface Spark {
  vx: number;
  vy: number;
  size: number;
}

export function sparks(count: number, spread: number, lift: number): Spark[] {
  return Array.from({ length: count }, () => ({
    vx: (Math.random() - 0.5) * spread,
    vy: -lift * (0.3 + Math.random()),
    size: 2 + Math.random() * 2.5,
  }));
}

/** Dessine les éclats `age` secondes après leur départ de (x, y). */
export function drawSparks(
  ctx: CanvasRenderingContext2D,
  list: Spark[],
  x: number,
  y: number,
  age: number,
  scale: number,
  life = 1.1,
): void {
  if (age > life) return;
  ctx.fillStyle = `rgba(255, 190, 70, ${1 - age / life})`;
  for (const spark of list) {
    const s = spark.size * Math.max(0.6, scale);
    ctx.fillRect(x + spark.vx * age * scale, y + spark.vy * age * scale + 420 * age * age * scale, s, s);
  }
}

/** Bombe rouge du jeu (comme sur l'accueil), posée au sol en (x, ground). */
export function drawBomb(ctx: CanvasRenderingContext2D, x: number, ground: number, r: number, age: number, fuse: number): void {
  const swell = 1 + 0.18 * Math.max(0, Math.sin(age * 22)) * Math.min(1, age / fuse);
  const by = ground - r * swell;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x, ground, r * 0.9, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e4262b';
  ctx.strokeStyle = '#6e0d10';
  ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.beginPath();
  ctx.arc(x, by, r * swell, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, by - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2a22';
  ctx.lineWidth = Math.max(1.2, r * 0.16);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.5, by - r * 0.85);
  ctx.lineTo(x + r * 0.7, by - r * 1.25);
  ctx.stroke();
  const blink = Math.floor(age * 14) % 2 === 0;
  ctx.fillStyle = blink ? '#fff3a0' : '#ff8a1f';
  ctx.beginPath();
  ctx.arc(x + r * 0.72, by - r * 1.3, r * (blink ? 0.4 : 0.3), 0, Math.PI * 2);
  ctx.fill();
}

/** Courbe lissée (Catmull-Rom) passant par `control`, échantillonnée finement. */
export function smoothPath(control: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < control.length - 1; i++) {
    const p0 = control[Math.max(0, i - 1)];
    const p1 = control[i];
    const p2 = control[i + 1];
    const p3 = control[Math.min(control.length - 1, i + 2)];
    for (let s = 0; s < 24; s++) {
      const t = s / 24;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      points.push({ x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  points.push(control[control.length - 1]);
  return points;
}

/** Mèche le long de `points`, consumée sur la fraction `progress`, avec son étincelle. */
export function drawFuse(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, progress: number): void {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const burnt = lengths[lengths.length - 1] * progress;
  let index = lengths.findIndex((length) => length >= burnt);
  if (index < 1) index = Math.max(1, index === -1 ? points.length - 1 : 1);
  const a = points[index - 1];
  const b = points[index];
  const f = (burnt - lengths[index - 1]) / Math.max(0.001, lengths[index] - lengths[index - 1]);
  const spark = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Partie consumée : une traînée de cendre rougeoyante qui s'éteint.
  ctx.strokeStyle = 'rgba(120, 50, 25, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < index; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineTo(spark.x, spark.y);
  ctx.stroke();
  // Partie restante : la corde, tressée.
  ctx.strokeStyle = '#6b4a2f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(spark.x, spark.y);
  for (let i = index; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.strokeStyle = '#a57a4c';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (progress >= 1) return;
  // L'étincelle : halo, cœur blanc et projections.
  const flicker = 0.8 + Math.random() * 0.4;
  const halo = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, 46 * flicker);
  halo.addColorStop(0, 'rgba(255, 250, 220, 1)');
  halo.addColorStop(0.2, 'rgba(255, 190, 70, 0.9)');
  halo.addColorStop(1, 'rgba(255, 90, 20, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, 46 * flicker, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6c8';
  for (let i = 0; i < 9; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 6 + Math.random() * 22;
    ctx.fillRect(spark.x + Math.cos(angle) * distance, spark.y + Math.sin(angle) * distance, 2, 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}
