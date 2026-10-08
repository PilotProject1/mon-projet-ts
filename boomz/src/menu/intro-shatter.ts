import { drawFuse, drawSparks, IMG_H, IMG_W, IntroScene, smoothPath, sparks, type Place, type Spark } from './intro-base';

/** Une longue mèche : le temps de la regarder brûler. */
const BURN_S = 2.4;
/** Fissures figées un instant avant que l'écran ne vole en éclats. */
const CRACK_S = 0.09;
const SHARDS_S = 1;
/** Le titre quitte le centre de l'écran pour sa place sur l'accueil. */
const MOVE_AT = 0.3;
const MOVE_S = 0.65;
const END_S = 1.25;
/** Point de l'image du titre où arrive la mèche : sous le milieu du mot. */
const FUSE_END = { x: 250, y: 236 };

interface Point {
  x: number;
  y: number;
}

interface Shard {
  points: Point[];
  center: Point;
  vx: number;
  vy: number;
  spin: number;
  heat: number;
}

interface Chip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  size: number;
  sides: number[];
}

/**
 * « L'écran en éclats » : le nom BOOMZ, éteint, au centre de l'écran. Une
 * longue mèche se consume jusqu'à lui ; il s'embrase et l'écran vole en
 * éclats, découvrant l'accueil, pendant que le titre gagne sa place.
 */
export class ShatterIntro extends IntroScene {
  private cold: HTMLCanvasElement | null = null;
  private exploded: number | null = null;
  private shards: Shard[] = [];
  private chips: Chip[] = [];
  private readonly sparks: Spark[] = sparks(46, 760, 460);
  private lastTick = 0;

  start(): void {
    // Le titre de l'accueil est caché : c'est celui de l'intro qui vient s'y poser.
    this.options.logo.style.visibility = 'hidden';
    super.start();
  }

  protected leave(seconds?: number): void {
    this.options.logo.style.visibility = '';
    super.leave(seconds);
  }

  /** Titre au centre de l'écran, à la taille qu'il aura sur l'accueil. */
  private centered(place: Place): Point {
    return { x: place.width / 2 - (IMG_W * place.scale) / 2, y: place.height * 0.4 - (IMG_H * place.scale) / 2 };
  }

  /** Coin du titre maintenant : au centre, puis en route vers sa place. */
  private titleAt(place: Place): Point {
    const from = this.centered(place);
    if (this.exploded === null) return from;
    const t = Math.min(1, Math.max(0, (this.clock - this.exploded - MOVE_AT) / MOVE_S));
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return { x: from.x + (place.x - from.x) * ease, y: from.y + (place.y - from.y) * ease };
  }

  /** Tracé de la mèche : en lacets dans le bas de l'écran, puis droit sur le mot. */
  private path(place: Place): Point[] {
    const { width: w, height: h, scale } = place;
    const corner = this.centered(place);
    const end = { x: corner.x + FUSE_END.x * scale, y: corner.y + FUSE_END.y * scale };
    const floor = corner.y + IMG_H * scale * 0.92;
    const row = (k: number) => h * 0.97 - ((h * 0.97 - floor) * k) / 4;
    return smoothPath([
      { x: -20, y: row(0) },
      { x: w * 0.86, y: row(0.3) },
      { x: w * 0.12, y: row(1.3) },
      { x: w * 0.88, y: row(2.3) },
      { x: w * 0.16, y: row(3.3) },
      { x: end.x + w * 0.14, y: row(4) },
      end,
    ]);
  }

  protected update(_dt: number, place: Place): void {
    if (this.exploded === null) {
      if (this.clock - this.lastTick > 0.2) {
        // Grésillement de la mèche, au toucher comme à l'oreille.
        if (this.lastTick === 0) this.options.sound({ kind: 'fuse', seconds: BURN_S });
        this.lastTick = this.clock;
        this.options.haptic({ kind: 'impact', style: 'light', intensity: 0.35 });
      }
      if (this.clock >= BURN_S) this.explode(place);
      return;
    }
    const age = this.clock - this.exploded;
    // Une fois les éclats partis, l'accueil se voit derrière.
    if (age > CRACK_S) this.opaque = false;
    if (age > END_S) this.leave();
  }

  private explode(place: Place): void {
    this.exploded = this.clock;
    this.shake(14, 0.45);
    this.options.sound({ kind: 'explosion', count: 3 });
    this.options.haptic({ kind: 'impact', style: 'heavy', intensity: 1 });
    const corner = this.centered(place);
    const center = { x: corner.x + (IMG_W * place.scale) / 2, y: corner.y + (IMG_H * place.scale) / 2 };
    this.shards = shatter(center, Math.hypot(place.width, place.height));
    // Éclats de pierre arrachés aux lettres.
    this.chips = Array.from({ length: 26 }, () => {
      const x = corner.x + (0.1 + Math.random() * 0.8) * IMG_W * place.scale;
      const y = corner.y + (0.25 + Math.random() * 0.5) * IMG_H * place.scale;
      const angle = Math.atan2(y - center.y, x - center.x) + (Math.random() - 0.5) * 0.8;
      const speed = 220 + Math.random() * 620;
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 160,
        spin: (Math.random() - 0.5) * 16,
        size: 4 + Math.random() * 9,
        sides: Array.from({ length: 5 }, () => 0.6 + Math.random() * 0.5),
      };
    });
  }

  protected drawScene(ctx: CanvasRenderingContext2D, place: Place): void {
    const corner = this.titleAt(place);
    const titlePlace = { ...place, x: corner.x, y: corner.y };

    if (this.exploded === null) {
      const progress = Math.min(1, this.clock / BURN_S);
      this.drawEmber(ctx, titlePlace, progress * 0.5);
      // Le mot, éteint, se réchauffe à mesure que l'étincelle approche.
      const w = IMG_W * place.scale;
      const h = IMG_H * place.scale;
      ctx.drawImage(this.coldTitle(), corner.x, corner.y, w, h);
      this.drawTitle(ctx, titlePlace, 0.08 + 0.4 * Math.pow(progress, 2.5));
      drawFuse(ctx, this.path(place), progress);
      return;
    }

    const age = this.clock - this.exploded;
    const cx = this.centered(place).x + (IMG_W * place.scale) / 2;
    const cy = this.centered(place).y + (IMG_H * place.scale) / 2;
    this.drawShards(ctx, Math.max(0, age - CRACK_S), age < CRACK_S);
    // Le mot s'embrase d'un coup, plus grand, puis se pose et rejoint sa place.
    const zoom = age < 0.35 ? 1 + 0.22 * Math.pow(1 - age / 0.35, 2) : 1;
    this.drawTitle(ctx, titlePlace, 1, zoom, Math.max(0, 0.9 - age / 0.6));
    this.drawChips(ctx, age);
    drawSparks(ctx, this.sparks, cx, cy, age, Math.max(0.7, place.scale), 1.2);
    if (age < 0.3) {
      ctx.fillStyle = `rgba(255, 244, 214, ${0.85 * (1 - age / 0.3)})`;
      ctx.fillRect(-20, -20, place.width + 40, place.height + 40);
    }
  }

  /** Le titre assombri (pierre froide), préparé une fois. */
  private coldTitle(): HTMLCanvasElement {
    if (this.cold) return this.cold;
    const canvas = document.createElement('canvas');
    canvas.width = IMG_W;
    canvas.height = IMG_H;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(this.title, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(24, 18, 16, 0.82)';
      ctx.fillRect(0, 0, IMG_W, IMG_H);
    }
    this.cold = canvas;
    return canvas;
  }

  /** L'écran, brisé en morceaux qui s'envolent vers le joueur. */
  private drawShards(ctx: CanvasRenderingContext2D, t: number, still: boolean): void {
    if (t > SHARDS_S) return;
    for (const shard of this.shards) {
      const dx = shard.vx * t;
      const dy = shard.vy * t + 900 * t * t;
      const grow = 1 + 0.9 * t;
      ctx.save();
      ctx.globalAlpha = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / (SHARDS_S - 0.55));
      ctx.translate(shard.center.x + dx, shard.center.y + dy);
      ctx.rotate(shard.spin * t);
      ctx.scale(grow, grow);
      ctx.beginPath();
      for (const [i, point] of shard.points.entries()) {
        const x = point.x - shard.center.x;
        const y = point.y - shard.center.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = `rgb(${18 + 40 * shard.heat}, ${14 + 12 * shard.heat}, ${13 + 4 * shard.heat})`;
      ctx.fill();
      ctx.strokeStyle = still ? 'rgba(255, 220, 140, 0.95)' : `rgba(255, 140, 40, ${0.5 + 0.5 * shard.heat})`;
      ctx.lineWidth = still ? 2.5 : 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawChips(ctx: CanvasRenderingContext2D, age: number): void {
    const life = 1.2;
    if (age > life) return;
    ctx.globalAlpha = 1 - age / life;
    for (const chip of this.chips) {
      ctx.save();
      ctx.translate(chip.x + chip.vx * age, chip.y + chip.vy * age + 700 * age * age);
      ctx.rotate(chip.spin * age);
      ctx.beginPath();
      for (const [i, side] of chip.sides.entries()) {
        const angle = (i / chip.sides.length) * Math.PI * 2;
        const r = chip.size * side;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#3a3230';
      ctx.fill();
      ctx.strokeStyle = '#ff7a24';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Découpe l'écran en éclats autour du point d'impact : des rayons et des
 * anneaux irréguliers, plus serrés près du centre comme sur une vitre brisée.
 */
function shatter(center: Point, reach: number): Shard[] {
  const rays = 18;
  const angles = Array.from({ length: rays }, (_, i) => ((i + 0.2 + Math.random() * 0.6) / rays) * Math.PI * 2);
  const rings = [0, 0.05, 0.13, 0.26, 0.45, 0.7, 1.15].map((k) => k * reach);
  const grid = rings.map((radius, j) =>
    angles.map((angle) => {
      const r = j === 0 ? 0 : radius * (0.85 + Math.random() * 0.3);
      return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
    }),
  );
  const shards: Shard[] = [];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < rays; i++) {
      const next = (i + 1) % rays;
      const points = j === 0 ? [center, grid[1][i], grid[1][next]] : [grid[j][i], grid[j][next], grid[j + 1][next], grid[j + 1][i]];
      const middle = {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
      };
      const angle = Math.atan2(middle.y - center.y, middle.x - center.x);
      const speed = 380 + Math.random() * 700 + j * 120;
      shards.push({
        points,
        center: middle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        spin: (Math.random() - 0.5) * 5,
        heat: Math.max(0, 1 - j / 3),
      });
    }
  }
  return shards;
}
