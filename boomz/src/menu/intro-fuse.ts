import { drawFuse, drawSparks, IMG_H, IMG_W, IntroScene, smoothPath, sparks, type Place, type Spark } from './intro-base';

/** Durée du trajet de l'étincelle le long de la mèche. */
const BURN_S = 1.7;
/** La bombe gonfle avant d'exploser. */
const SWELL_S = 0.5;
const HOLD_S = 1.1;
/** Bout de la mèche dans l'image de la bombe (fraction de sa taille). */
const TIP = { x: 0.76, y: 0.16 };

interface Cube {
  vx: number;
  vy: number;
  spin: number;
  size: number;
  hot: boolean;
}

/**
 * « La mèche » : une mèche allumée serpente sur l'écran noir jusqu'à la grosse
 * bombe en cubes ; elle explose et le titre BOOMZ surgit des éclats.
 */
export class FuseIntro extends IntroScene {
  private exploded: number | null = null;
  private readonly cubes: Cube[] = Array.from({ length: 28 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 160 + Math.random() * 420;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 120,
      spin: (Math.random() - 0.5) * 14,
      size: 5 + Math.random() * 11,
      hot: Math.random() < 0.45,
    };
  });
  private readonly sparks: Spark[] = sparks(40, 700, 420);
  private lastTick = 0;

  protected images(): string[] {
    return ['/intro-bomb.jpg'];
  }

  /** Centre et taille de la bombe : à la place du titre. */
  private bomb(place: Place): { cx: number; cy: number; size: number } {
    const size = Math.min(IMG_W * place.scale * 0.72, place.height * 0.36);
    return { cx: place.x + (IMG_W * place.scale) / 2, cy: place.y + (IMG_H * place.scale) / 2, size };
  }

  /** Tracé de la mèche : du bas de l'écran, en lacets, jusqu'au bout de la mèche de la bombe. */
  private path(place: Place): Array<{ x: number; y: number }> {
    const { width: w, height: h } = place;
    const { cx, cy, size } = this.bomb(place);
    const tip = { x: cx + (TIP.x - 0.5) * size, y: cy + (TIP.y - 0.5) * size };
    const floor = Math.max(cy + size * 0.7, h * 0.55);
    const control = [
      { x: -20, y: h * 0.94 },
      { x: w * 0.82, y: h * 0.88 },
      { x: w * 0.18, y: (h * 0.8 + floor) / 2 },
      { x: w * 0.7, y: floor },
      { x: Math.min(w - 14, tip.x + size * 0.32), y: cy + size * 0.1 },
      tip,
    ];
    return smoothPath(control);
  }

  protected update(_dt: number, _place: Place): void {
    if (this.clock < BURN_S && this.clock - this.lastTick > 0.2) {
      // Grésillement de la mèche, au toucher comme à l'oreille.
      if (this.lastTick === 0) this.options.sound({ kind: 'fuse', seconds: BURN_S });
      this.lastTick = this.clock;
      this.options.haptic({ kind: 'impact', style: 'light', intensity: 0.35 });
    }
    if (this.exploded === null && this.clock >= BURN_S + SWELL_S) {
      this.exploded = this.clock;
      this.shake(12, 0.45);
      this.options.sound({ kind: 'explosion', count: 3 });
      this.options.haptic({ kind: 'impact', style: 'heavy', intensity: 1 });
    }
    if (this.exploded !== null && this.clock - this.exploded > HOLD_S) this.leave();
  }

  protected drawScene(ctx: CanvasRenderingContext2D, place: Place): void {
    const progress = Math.min(1, this.clock / BURN_S);
    const { cx, cy, size } = this.bomb(place);
    this.drawEmber(ctx, place, this.exploded === null ? progress * 0.4 : 1);

    if (this.exploded === null) {
      drawFuse(ctx, this.path(place), progress);
      this.drawBombImage(ctx, cx, cy, size, progress);
      return;
    }

    const age = this.clock - this.exploded;
    // Le titre surgit de l'explosion, plus grand et chauffé à blanc, puis se pose.
    const zoom = age < 0.35 ? 1 + 0.5 * Math.pow(1 - age / 0.35, 2) : 1;
    this.drawTitle(ctx, place, Math.min(1, age / 0.12), zoom, Math.max(0, 1 - age / 0.7));
    this.drawCubes(ctx, cx, cy, age, place.scale);
    drawSparks(ctx, this.sparks, cx, cy, age, Math.max(0.7, place.scale), 1.3);
    // Onde de choc et éclair blanc.
    if (age < 0.5) {
      ctx.strokeStyle = `rgba(255, 220, 150, ${0.8 * (1 - age / 0.5)})`;
      ctx.lineWidth = 10 * (1 - age / 0.5) + 1;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.3 + age * Math.max(place.width, place.height) * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (age < 0.35) {
      ctx.fillStyle = `rgba(255, 244, 214, ${0.9 * (1 - age / 0.35)})`;
      ctx.fillRect(-20, -20, place.width + 40, place.height + 40);
    }
  }

  /** La bombe sort de l'ombre à l'approche de l'étincelle, puis gonfle. */
  private drawBombImage(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, progress: number): void {
    const swellAge = this.clock - BURN_S;
    const swell = swellAge > 0 ? 1 + 0.08 * Math.abs(Math.sin(swellAge * 18)) + 0.1 * (swellAge / SWELL_S) : 1;
    const s = size * swell;
    // Image sur fond noir : en mode « screen », le noir disparaît dans le fond.
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.25 + 0.75 * Math.pow(progress, 1.5);
    ctx.drawImage(this.loaded[0], cx - s / 2, cy - s / 2, s, s);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Les cubes de la bombe, projetés dans tous les sens. */
  private drawCubes(ctx: CanvasRenderingContext2D, cx: number, cy: number, age: number, scale: number): void {
    const life = 1.2;
    if (age > life) return;
    const k = Math.max(0.7, scale * 1.4);
    for (const cube of this.cubes) {
      const x = cx + cube.vx * age * k;
      const y = cy + (cube.vy * age + 380 * age * age) * k;
      const s = cube.size * k;
      ctx.save();
      ctx.globalAlpha = 1 - age / life;
      ctx.translate(x, y);
      ctx.rotate(cube.spin * age);
      ctx.fillStyle = cube.hot ? '#ff8a1f' : '#2a2422';
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = cube.hot ? '#fff0a0' : '#ff6a1a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }
}
