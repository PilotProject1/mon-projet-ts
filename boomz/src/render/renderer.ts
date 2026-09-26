import { BOMB_FUSE_TICKS, FLAME_TICKS, SUDDEN_DEATH_TICKS, TICK_RATE } from '../game/constants';
import type { MatchState } from '../game/match';
import { createRng } from '../game/rng';
import { Tile, type Bomb, type Player, type RoundState } from '../game/types';
import { drawCharacter, PLAYER_LOOKS } from './characters';

// Arène « Chantier » : sol de terre battue, piliers en béton cerclés de bandes
// de sécurité, caisses en bois à faire sauter.
const ARENA = {
  groundA: '#d8b57a',
  groundB: '#d1ac6f',
  groundSpeck: 'rgba(120, 84, 40, 0.18)',
  groundLight: 'rgba(255, 244, 214, 0.22)',
  concreteTop: '#c3c6cc',
  concreteTopEdge: '#d9dbe0',
  concreteFront: '#8b909b',
  concreteDark: '#6c717c',
  hazardYellow: '#f5c211',
  hazardBlack: '#23242b',
  crateTop: '#dea461',
  crateFront: '#a8672c',
  crateLine: '#9a5e28',
  crateBolt: '#6b4a2a',
  shadow: 'rgba(40, 24, 8, 0.28)',
};

/**
 * Hauteur de la face avant des murs et caisses (vue 3/4), en fraction de case.
 * Chaque objet reste dans sa case : il ne masque jamais un personnage voisin.
 */
const DEPTH = 0.3;
const MAX_PARTICLES = 320;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private cell = 32;
  /** Sol pré-dessiné : il ne change jamais pendant une manche. */
  private floor: HTMLCanvasElement | null = null;
  private particles: Particle[] = [];
  private shake = 0;
  private lastFrame = 0;
  /** État précédent, pour repérer explosions et blocs détruits entre deux images. */
  private previous: { roundNumber: number; tiles: Tile[]; bombs: Bomb[] } | null = null;
  private readonly random = createRng(12345);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  /** Ajuste la résolution du canvas à sa taille affichée (écrans haute densité). */
  resize(width: number, height: number): void {
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.floor = null;
  }

  /** `you` : numéro du joueur de ce téléphone, signalé par un repère au-dessus de lui. */
  render(match: MatchState, you: number | null = null, now = performance.now()): void {
    const { ctx, canvas } = this;
    // Canvas encore caché (écran non affiché) : rien à dessiner.
    if (canvas.width === 0 || canvas.height === 0) return;
    const round = match.round;
    this.cell = canvas.width / round.width;
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.1) : 0;
    this.lastFrame = now;

    this.detectEvents(match);
    this.updateParticles(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.shake > 0) {
      const amplitude = this.cell * 0.06 * this.shake;
      ctx.translate((this.random() - 0.5) * amplitude, (this.random() - 0.5) * amplitude);
      this.shake = Math.max(0, this.shake - dt * 5);
    }

    ctx.drawImage(this.floorLayer(round), 0, 0);
    for (let y = 0; y < round.height; y++) {
      for (let x = 0; x < round.width; x++) this.drawTile(round, x, y);
    }
    // Les flammes passent sur les caisses qui brûlent, sous les personnages.
    this.drawFlames(round);

    // La manche est figée une fois terminée : on poursuit l'animation des
    // éliminations avec l'horloge de la phase.
    const frozen = match.phase === 'roundOver' || match.phase === 'matchOver';
    const tick = round.tick + (frozen ? match.phaseTick : 0);
    for (const bomb of round.bombs) this.drawBomb(bomb, tick);
    // Du fond vers l'avant : un personnage plus bas à l'écran passe devant.
    const players = [...round.players].sort((a, b) => a.y - b.y);
    for (const player of players) this.drawPlayer(player, tick, player.id === you);

    this.drawParticles();
    this.drawSuddenDeathWarning(round);
  }

  // ---- Sol ----

  private floorLayer(round: RoundState): HTMLCanvasElement {
    if (this.floor && this.floor.width === this.canvas.width && this.floor.height === this.canvas.height) {
      return this.floor;
    }
    const layer = document.createElement('canvas');
    layer.width = this.canvas.width;
    layer.height = this.canvas.height;
    const ctx = layer.getContext('2d');
    if (!ctx) return layer;
    const cell = this.cell;
    const rng = createRng(7);
    for (let y = 0; y < round.height; y++) {
      for (let x = 0; x < round.width; x++) {
        const px = x * cell;
        const py = y * cell;
        ctx.fillStyle = (x + y) % 2 === 0 ? ARENA.groundA : ARENA.groundB;
        ctx.fillRect(px, py, cell + 1, cell + 1);
        // Graviers et reflets, toujours au même endroit grâce à la graine.
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = rng() < 0.7 ? ARENA.groundSpeck : ARENA.groundLight;
          const size = cell * (0.03 + rng() * 0.05);
          ctx.beginPath();
          ctx.arc(px + rng() * cell, py + rng() * cell, size, 0, Math.PI * 2);
          ctx.fill();
        }
        // Joint discret entre les dalles de terre.
        ctx.fillStyle = 'rgba(120, 84, 40, 0.12)';
        ctx.fillRect(px, py + cell - 1, cell, 1);
        ctx.fillRect(px + cell - 1, py, 1, cell);
      }
    }
    this.floor = layer;
    return layer;
  }

  // ---- Murs et caisses ----

  private drawTile(round: RoundState, x: number, y: number): void {
    const tile = round.tiles[y * round.width + x];
    if (tile === Tile.Floor) return;
    if (tile === Tile.Wall) {
      const border = x === 0 || y === 0 || x === round.width - 1 || y === round.height - 1;
      this.drawConcrete(x, y, border);
      return;
    }
    const burning = tile === Tile.Burning;
    const progress = burning ? 1 - round.flames[y * round.width + x] / FLAME_TICKS : 0;
    this.drawCrate(x, y, burning, progress);
  }

  private drawConcrete(x: number, y: number, border: boolean): void {
    const { ctx, cell } = this;
    const px = x * cell;
    const py = y * cell;
    const depth = cell * DEPTH;

    // Ombre portée sur le sol, vers le bas à droite.
    ctx.fillStyle = ARENA.shadow;
    ctx.fillRect(px + cell * 0.12, py + cell * 0.12, cell, cell - depth * 0.3);

    // Face avant, avec une bande de sécurité jaune et noire.
    ctx.fillStyle = ARENA.concreteFront;
    ctx.fillRect(px, py + cell - depth, cell, depth);
    const bandY = py + cell - depth * 0.72;
    const bandH = depth * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, bandY, cell, bandH);
    ctx.clip();
    ctx.fillStyle = border ? ARENA.hazardYellow : ARENA.concreteDark;
    ctx.fillRect(px, bandY, cell, bandH);
    if (border) {
      ctx.fillStyle = ARENA.hazardBlack;
      const stripe = cell * 0.18;
      for (let sx = px - cell; sx < px + cell * 2; sx += stripe * 2) {
        ctx.beginPath();
        ctx.moveTo(sx, bandY + bandH);
        ctx.lineTo(sx + stripe, bandY + bandH);
        ctx.lineTo(sx + stripe + bandH, bandY);
        ctx.lineTo(sx + bandH, bandY);
        ctx.fill();
      }
    }
    ctx.restore();

    // Dessus.
    const topH = cell - depth;
    ctx.fillStyle = ARENA.concreteTop;
    ctx.fillRect(px, py, cell, topH);
    ctx.fillStyle = ARENA.concreteTopEdge;
    ctx.fillRect(px, py, cell, cell * 0.07);
    if (!border) {
      // Pilier : plaque centrale et petits trous de coffrage.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = Math.max(1, cell * 0.04);
      ctx.strokeRect(px + cell * 0.14, py + topH * 0.14, cell * 0.72, topH * 0.72);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (const [ox, oy] of [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]]) {
        ctx.beginPath();
        ctx.arc(px + cell * ox, py + topH * oy, cell * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawCrate(x: number, y: number, burning: boolean, progress: number): void {
    const { ctx, cell } = this;
    const inset = cell * (0.05 + progress * 0.28);
    const size = cell - inset * 2;
    const depth = size * DEPTH;
    const px = x * cell + inset;
    const py = y * cell + inset;
    ctx.globalAlpha = 1 - progress * 0.85;

    ctx.fillStyle = ARENA.shadow;
    ctx.fillRect(px + size * 0.12, py + size * 0.14, size, size - depth * 0.3);

    ctx.fillStyle = burning ? '#6d3217' : ARENA.crateFront;
    ctx.fillRect(px, py + size - depth, size, depth);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(px, py + size - depth * 0.5, size, 1);

    const topH = size - depth;
    ctx.fillStyle = burning ? '#b8521f' : ARENA.crateTop;
    ctx.fillRect(px, py, size, topH);
    // Planches et croisillon.
    ctx.strokeStyle = burning ? '#7a3313' : ARENA.crateLine;
    ctx.lineWidth = Math.max(1, cell * 0.045);
    ctx.strokeRect(px + size * 0.06, py + topH * 0.08, size * 0.88, topH * 0.84);
    ctx.beginPath();
    ctx.moveTo(px + size * 0.1, py + topH * 0.12);
    ctx.lineTo(px + size * 0.9, py + topH * 0.88);
    ctx.moveTo(px + size * 0.9, py + topH * 0.12);
    ctx.lineTo(px + size * 0.1, py + topH * 0.88);
    ctx.stroke();
    ctx.fillStyle = ARENA.crateBolt;
    for (const [ox, oy] of [[0.12, 0.14], [0.88, 0.14], [0.12, 0.86], [0.88, 0.86]]) {
      ctx.beginPath();
      ctx.arc(px + size * ox, py + topH * oy, size * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Flammes ----

  private drawFlames(round: RoundState): void {
    const { ctx, cell } = this;
    const flameAt = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < round.width && y < round.height && round.flames[y * round.width + x] > 0;
    ctx.save();
    for (let y = 0; y < round.height; y++) {
      for (let x = 0; x < round.width; x++) {
        const remaining = round.flames[y * round.width + x];
        if (remaining <= 0) continue;
        const life = remaining / FLAME_TICKS;
        const thickness = cell * (0.5 + 0.34 * Math.sin(life * Math.PI));
        const cx = x * cell + cell / 2;
        const cy = y * cell + cell / 2;
        // Halo lumineux sous la flamme.
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.9);
        glow.addColorStop(0, `rgba(255, 150, 40, ${0.35 * life})`);
        glow.addColorStop(1, 'rgba(255, 90, 20, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx - cell, cy - cell, cell * 2, cell * 2);
        ctx.globalCompositeOperation = 'source-over';
        const layers: Array<[string, number]> = [
          ['#e8401c', 1],
          ['#ff9a22', 0.7],
          ['#ffe27a', 0.42],
          ['#fffbe8', 0.18],
        ];
        for (const [color, scale] of layers) {
          const t = thickness * scale;
          ctx.fillStyle = color;
          // Tronçon horizontal et vertical, reliés aux flammes voisines.
          const left = flameAt(x - 1, y) ? x * cell : cx - t / 2;
          const right = flameAt(x + 1, y) ? (x + 1) * cell : cx + t / 2;
          const top = flameAt(x, y - 1) ? y * cell : cy - t / 2;
          const bottom = flameAt(x, y + 1) ? (y + 1) * cell : cy + t / 2;
          ctx.fillRect(left, cy - t / 2, right - left, t);
          ctx.fillRect(cx - t / 2, top, t, bottom - top);
          ctx.beginPath();
          ctx.arc(cx, cy, t / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ---- Bombes ----

  private drawBomb(bomb: Bomb, tick: number): void {
    const { ctx, cell } = this;
    const cx = bomb.cx * cell + cell / 2;
    const cy = bomb.cy * cell + cell / 2;
    // Pulsation qui s'accélère à l'approche de l'explosion.
    const urgency = 1 - bomb.fuse / BOMB_FUSE_TICKS;
    const pulse = 1 + 0.08 * Math.sin(tick * (0.15 + urgency * 0.5));
    const radius = cell * 0.36 * pulse;

    ctx.fillStyle = ARENA.shadow;
    ctx.beginPath();
    ctx.ellipse(cx + radius * 0.15, cy + radius * 0.85, radius * 0.95, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    const hot = urgency > 0.75 && Math.floor(tick / 4) % 2 === 0;
    const body = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, radius * 0.1, cx, cy, radius);
    body.addColorStop(0, hot ? '#a33b2a' : '#5a5e70');
    body.addColorStop(1, hot ? '#4a1410' : '#16171e');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#0c0d12';
    ctx.lineWidth = Math.max(1, cell * 0.035);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - radius * 0.38, cy - radius * 0.42, radius * 0.18, radius * 0.11, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // Bouchon et mèche.
    ctx.fillStyle = '#3a3d4a';
    ctx.fillRect(cx + radius * 0.25, cy - radius * 1.05, radius * 0.4, radius * 0.32);
    ctx.strokeStyle = '#7a6440';
    ctx.lineWidth = Math.max(1.5, cell * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.45, cy - radius * 1.02);
    ctx.quadraticCurveTo(cx + radius * 0.9, cy - radius * 1.45, cx + radius * 0.75, cy - radius * 1.6);
    ctx.stroke();
    const sparkX = cx + radius * 0.75;
    const sparkY = cy - radius * 1.6;
    const spark = cell * (0.07 + 0.03 * Math.sin(tick * 1.3));
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, spark * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, spark, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Personnages ----

  private drawPlayer(player: Player, tick: number, isYou: boolean): void {
    const { ctx, cell } = this;
    const look = PLAYER_LOOKS[player.id % PLAYER_LOOKS.length];
    let alpha = 1;
    let scale = 1;
    if (!player.alive) {
      const since = tick - (player.diedAt ?? tick);
      alpha = Math.max(0, 1 - since / 40);
      scale = 1 + since / 60;
      if (alpha <= 0) return;
    }
    const bob = player.moving && player.alive ? Math.abs(Math.sin(tick * 0.35)) * cell * 0.06 : 0;
    const cx = player.x * cell;
    const cy = player.y * cell - cell * 0.08 - bob;
    const r = cell * 0.36 * scale;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = ARENA.shadow;
    ctx.beginPath();
    ctx.ellipse(player.x * cell, player.y * cell + r * 0.8, r * 0.8, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isYou && player.alive) {
      // Anneau au sol aux couleurs du joueur.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, cell * 0.05);
      ctx.beginPath();
      ctx.ellipse(player.x * cell, player.y * cell + r * 0.8, r * 0.95, r * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawCharacter(ctx, look, cx, cy, r, player.facing);
    ctx.globalAlpha = 1;

    if (isYou && player.alive) this.drawYouMarker(cx, cy - r * 1.55, tick);
  }

  private drawYouMarker(x: number, y: number, tick: number): void {
    const { ctx, cell } = this;
    const size = cell * 0.15;
    const top = y + Math.sin(tick * 0.12) * cell * 0.04;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#15161f';
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    ctx.moveTo(x - size, top - size);
    ctx.lineTo(x + size, top - size);
    ctx.lineTo(x, top + size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ---- Effets ----

  private detectEvents(match: MatchState): void {
    const round = match.round;
    const previous = this.previous;
    this.previous = { roundNumber: match.roundNumber, tiles: [...round.tiles], bombs: round.bombs };
    if (!previous || previous.roundNumber !== match.roundNumber) {
      this.particles = [];
      return;
    }
    const cell = this.cell;
    for (const bomb of previous.bombs) {
      if (round.bombs.some((other) => other.id === bomb.id)) continue;
      if (round.flames[bomb.cy * round.width + bomb.cx] <= 0) continue; // murée par le resserrement
      this.shake = 1;
      this.emit((bomb.cx + 0.5) * cell, (bomb.cy + 0.5) * cell, 18, ['#fff3a0', '#ffb52e', '#ff6a1f'], 3.2, 0.5, 0);
      this.emit((bomb.cx + 0.5) * cell, (bomb.cy + 0.3) * cell, 6, ['rgba(70,64,60,0.55)', 'rgba(110,100,92,0.45)'], 0.9, 1.1, -0.4);
    }
    for (let i = 0; i < round.tiles.length; i++) {
      if (previous.tiles[i] === Tile.Block && round.tiles[i] === Tile.Burning) {
        const x = ((i % round.width) + 0.5) * cell;
        const y = (Math.floor(i / round.width) + 0.3) * cell;
        this.emit(x, y, 10, [ARENA.crateTop, ARENA.crateFront, ARENA.crateLine], 2.4, 0.9, 6);
      }
    }
  }

  /** Projette des particules ; vitesse en cases par seconde, gravité en cases/s². */
  private emit(x: number, y: number, count: number, colors: string[], speed: number, life: number, gravity: number): void {
    const cell = this.cell;
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = this.random() * Math.PI * 2;
      const velocity = (0.4 + this.random() * 0.6) * speed * cell;
      const maxLife = life * (0.6 + this.random() * 0.4);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - (gravity > 0 ? speed * cell * 0.6 : 0),
        life: maxLife,
        maxLife,
        size: cell * (0.05 + this.random() * 0.07),
        color: colors[Math.floor(this.random() * colors.length)],
        gravity: gravity * cell,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.vy += particle.gravity * dt;
      particle.vx *= 1 - dt * 2;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  private drawParticles(): void {
    const { ctx } = this;
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      const size = particle.size * (0.5 + 0.5 * (particle.life / particle.maxLife));
      ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  private drawSuddenDeathWarning(round: RoundState): void {
    const remaining = SUDDEN_DEATH_TICKS - round.tick;
    if (remaining > 5 * TICK_RATE || remaining < 0) return;
    const { ctx, canvas } = this;
    if (Math.floor(round.tick / 15) % 2 === 0) {
      ctx.strokeStyle = 'rgba(255, 60, 40, 0.8)';
      ctx.lineWidth = this.cell * 0.2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }
  }
}
