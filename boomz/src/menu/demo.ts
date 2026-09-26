import { COUNTDOWN_TICKS, TICK_RATE } from '../game/constants';
import { createMatch, stepMatch, type MatchState } from '../game/match';
import { cellOf } from '../game/round';
import { createRng } from '../game/rng';
import { ARENA_IDS, type Direction, type PlayerInput } from '../game/types';
import { drawCharacter, PLAYER_LOOKS } from '../render/characters';
import { Renderer } from '../render/renderer';

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
/** Le fond n'a pas besoin de 60 images par seconde : on économise la batterie. */
const FRAME_MS = 1000 / 30;

interface Bot {
  direction: Direction | null;
  /** Ticks restants avant de changer d'idée. */
  hold: number;
  lastX: number;
  lastY: number;
}

/**
 * Partie de démonstration derrière le menu : quatre personnages automatiques
 * se promènent et posent des bombes, sur une arène différente à chaque manche.
 */
export class MenuDemo {
  private readonly renderer: Renderer;
  private readonly rng = createRng(Date.now() >>> 0);
  private match: MatchState;
  private bots: Bot[] = [];
  private running = false;
  private lastFrame = 0;
  private arenaIndex = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.match = this.newMatch();
    new ResizeObserver(([entry]) => {
      this.renderer.resize(entry.contentRect.width, entry.contentRect.height);
    }).observe(canvas);
  }

  private newMatch(): MatchState {
    const arena = ARENA_IDS[this.arenaIndex++ % ARENA_IDS.length];
    const match = createMatch(4, Math.floor(this.rng() * 2 ** 31), arena);
    // Pas de compte à rebours en fond : on commence directement à jouer.
    for (let i = 0; i < COUNTDOWN_TICKS; i++) stepMatch(match, []);
    this.bots = match.round.players.map((player) => ({ direction: null, hold: 0, lastX: player.x, lastY: player.y }));
    return match;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame((now) => this.frame(now));
  }

  stop(): void {
    this.running = false;
  }

  private frame(now: number): void {
    if (!this.running) return;
    requestAnimationFrame((time) => this.frame(time));
    if (document.hidden || now - this.lastFrame < FRAME_MS) return;
    const ticks = this.lastFrame ? Math.min(4, Math.round((now - this.lastFrame) / (1000 / TICK_RATE))) : 1;
    this.lastFrame = now;
    for (let i = 0; i < ticks; i++) this.step();
    this.renderer.render(this.match, null, now);
  }

  private step(): void {
    const match = this.match;
    if (match.phase !== 'playing') {
      // Manche finie : on enchaîne aussitôt sur une autre arène.
      this.match = this.newMatch();
      return;
    }
    const inputs: PlayerInput[] = match.round.players.map((player, id) => this.think(id, player.x, player.y));
    stepMatch(match, inputs);
  }

  /** Comportement simple : marcher, changer de direction si bloqué, poser parfois une bombe. */
  private think(id: number, x: number, y: number): PlayerInput {
    const bot = this.bots[id];
    const stuck = Math.abs(x - bot.lastX) + Math.abs(y - bot.lastY) < 0.001;
    bot.lastX = x;
    bot.lastY = y;
    bot.hold--;
    if (bot.hold <= 0 || (stuck && bot.direction)) {
      bot.direction = this.rng() < 0.15 ? null : DIRECTIONS[Math.floor(this.rng() * 4)];
      bot.hold = 20 + Math.floor(this.rng() * 50);
    }
    const [cx, cy] = cellOf(this.match.round.players[id]);
    const centered = Math.abs(x - (cx + 0.5)) < 0.1 && Math.abs(y - (cy + 0.5)) < 0.1;
    const bomb = centered && this.rng() < 0.012;
    if (bomb) bot.hold = 0; // après une bombe, repartir ailleurs
    return { direction: bot.direction, bomb };
  }
}

/** Boomer en grand, bombe allumée à la main, pour l'accueil. */
export function drawMascot(canvas: HTMLCanvasElement): void {
  const size = canvas.clientWidth || 120;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  drawCharacter(ctx, PLAYER_LOOKS[0], size * 0.44, size * 0.56, size * 0.34, 'down');
  // La bombe signature, tenue à droite.
  const bx = size * 0.74;
  const by = size * 0.7;
  const r = size * 0.13;
  ctx.fillStyle = '#1f2230';
  ctx.strokeStyle = '#0c0d12';
  ctx.lineWidth = size * 0.02;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a6440';
  ctx.lineWidth = size * 0.018;
  ctx.beginPath();
  ctx.moveTo(bx + r * 0.4, by - r * 0.9);
  ctx.quadraticCurveTo(bx + r, by - r * 1.5, bx + r * 0.8, by - r * 1.8);
  ctx.stroke();
  ctx.fillStyle = '#ff8a1f';
  ctx.beginPath();
  ctx.arc(bx + r * 0.8, by - r * 1.8, size * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3a0';
  ctx.beginPath();
  ctx.arc(bx + r * 0.8, by - r * 1.8, size * 0.018, 0, Math.PI * 2);
  ctx.fill();
}
