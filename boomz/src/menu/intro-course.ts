import { drawCharacter } from '../render/characters';
import { drawBomb, drawSparks, IMG_H, IntroScene, sparks, type Place, type Spark } from './intro-base';

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
  sparks: Spark[];
}

/**
 * « La course aux bombes » : le personnage du joueur traverse l'écran en
 * lâchant cinq bombes, et chaque explosion fait apparaître une lettre de BOOMZ.
 */
export class CourseIntro extends IntroScene {
  private readonly bombs: Bomb[] = [];
  private readonly blasts: Blast[] = [];
  private readonly revealed = [false, false, false, false, false];
  private runnerX = -40;
  private runnerPhase = 0;
  private finishedAt: number | null = null;

  /** Abscisse (image) de la séparation `i` à la hauteur `y` (image). */
  private cut(i: number, y: number): number {
    return CUTS[i] + (CUT_Y - y) * LEAN;
  }

  /** Abscisse (écran) où tombe la bombe de la lettre `i`. */
  private bombX(place: Place, i: number): number {
    return place.x + ((this.cut(i, RUN_Y) + this.cut(i + 1, RUN_Y)) / 2) * place.scale;
  }

  protected update(dt: number, place: Place): void {
    // Le titre se traverse en un peu plus d'une seconde, quelle que soit la taille d'écran.
    this.runnerX += Math.max(260, place.width / 2.6, 330 * place.scale) * dt;
    this.runnerPhase += dt * 16;

    const next = this.bombs.length;
    if (next < 5 && this.runnerX >= this.bombX(place, next)) {
      this.bombs.push({ letter: next, x: this.bombX(place, next), lit: this.clock, blown: false });
      this.options.sound({ kind: 'bombPlaced', mine: true });
      this.options.haptic({ kind: 'impact', style: 'light', intensity: 0.5 });
    }

    for (const bomb of this.bombs) {
      if (bomb.blown || this.clock - bomb.lit < FUSE_S) continue;
      bomb.blown = true;
      this.revealed[bomb.letter] = true;
      const last = bomb.letter === 4;
      this.blasts.push({ letter: bomb.letter, x: bomb.x, at: this.clock, sparks: sparks(last ? 30 : 18, 320, 260) });
      this.shake(last ? 9 : 5, last ? 0.4 : 0.22);
      this.options.sound({ kind: 'explosion', count: last ? 3 : 1 });
      this.options.haptic({ kind: 'impact', style: last ? 'heavy' : 'medium', intensity: last ? 1 : 0.8 });
      if (last) this.finishedAt = this.clock;
    }

    if (this.finishedAt !== null && this.clock - this.finishedAt > HOLD_S && this.runnerX > place.width + 30) this.leave();
  }

  protected drawScene(ctx: CanvasRenderingContext2D, place: Place): void {
    // Lueur de braise derrière le titre, qui grandit avec les lettres révélées.
    this.drawEmber(ctx, place, this.revealed.filter(Boolean).length / 5);
    const ground = place.y + RUN_Y * place.scale;
    this.drawLetters(ctx, place);
    const r = Math.max(7, 15 * place.scale);
    for (const bomb of this.bombs) if (!bomb.blown) drawBomb(ctx, bomb.x, ground, r, this.clock - bomb.lit, FUSE_S);
    this.drawRunner(ctx, place, ground);
    this.drawBlasts(ctx, place, ground);
    // Fin : le titre complet s'embrase d'un coup.
    if (this.finishedAt !== null) {
      const t = (this.clock - this.finishedAt) / HOLD_S;
      if (t < 1) {
        ctx.globalCompositeOperation = 'lighter';
        this.drawTitle(ctx, place, 0.45 * Math.sin(Math.min(1, t * 1.6) * Math.PI));
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  /** Chaque lettre révélée surgit un peu plus grande, puis se pose à sa place. */
  private drawLetters(ctx: CanvasRenderingContext2D, place: Place): void {
    const { x, y, scale } = place;
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
      // Encore chauffée à blanc juste après l'explosion.
      this.drawTitle(ctx, place, 1, 1, age < 0.45 ? 0.8 * (1 - age / 0.45) : 0);
      ctx.restore();
    }
  }

  private drawRunner(ctx: CanvasRenderingContext2D, place: Place, ground: number): void {
    const r = Math.max(14, 30 * place.scale);
    if (this.runnerX > place.width + r * 2) return;
    const bob = Math.abs(Math.sin(this.runnerPhase)) * r * 0.22;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(this.runnerX, ground, r * 0.7, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCharacter(ctx, this.options.look, this.runnerX, ground - r * 1.04 - bob, r, 'right');
  }

  private drawBlasts(ctx: CanvasRenderingContext2D, place: Place, ground: number): void {
    const { x, y, scale } = place;
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
      drawSparks(ctx, blast.sparks, blast.x, ground - 6, age, scale);
    }
  }
}
