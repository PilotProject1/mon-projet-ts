import { BOMB_FUSE_TICKS, FLAME_TICKS, SUDDEN_DEATH_TICKS, TICK_RATE } from '../game/constants';
import type { MatchState } from '../game/match';
import { createRng } from '../game/rng';
import {
  Bonus,
  CONVEYOR_DIRECTIONS,
  DIRECTION_VECTORS,
  Feature,
  Tile,
  type ArenaId,
  type Bomb,
  type Player,
  type RoundState,
} from '../game/types';
import { drawBonusIcon } from './bonuses';
import { drawCharacter, HERO_COLORS, lookFor } from './characters';
import { defaultCharacter, FREEZE_RADIUS, Hero } from '../game/powers';
import { toScreenRound } from './view';

interface Theme {
  groundA: string;
  groundB: string;
  groundSpeck: string;
  groundLight: string;
  groundJoint: string;
  wallTop: string;
  wallTopEdge: string;
  wallFront: string;
  /** Bande sur la face avant des piliers. */
  wallBand: string;
  /** Rayures de la bordure de l'arène. */
  stripeA: string;
  stripeB: string;
  pillarStyle: 'formwork' | 'lab' | 'carved' | 'hull';
  blockTop: string;
  blockFront: string;
  blockLine: string;
  blockBolt: string;
  blockStyle: 'crate' | 'metal' | 'stone' | 'cargo';
  shadow: string;
}

// Une ambiance par arène (thèmes de la roadmap). Toutes partagent la même
// lecture : sol clair et plat, murs en relief, caisses destructibles bien
// distinctes des piliers.
const THEMES: Record<ArenaId, Theme> = {
  // Terre battue, piliers en béton, bandes de sécurité, caisses en bois.
  chantier: {
    groundA: '#d8b57a',
    groundB: '#d1ac6f',
    groundSpeck: 'rgba(120, 84, 40, 0.18)',
    groundLight: 'rgba(255, 244, 214, 0.22)',
    groundJoint: 'rgba(120, 84, 40, 0.12)',
    wallTop: '#c3c6cc',
    wallTopEdge: '#d9dbe0',
    wallFront: '#8b909b',
    wallBand: '#6c717c',
    stripeA: '#f5c211',
    stripeB: '#23242b',
    pillarStyle: 'formwork',
    blockTop: '#dea461',
    blockFront: '#a8672c',
    blockLine: '#9a5e28',
    blockBolt: '#6b4a2a',
    blockStyle: 'crate',
    shadow: 'rgba(40, 24, 8, 0.28)',
  },
  // Carrelage blanc, machines aux voyants turquoise, conteneurs d'échantillons ambrés.
  laboratoire: {
    groundA: '#e8edf2',
    groundB: '#dfe6ed',
    groundSpeck: 'rgba(90, 120, 150, 0.1)',
    groundLight: 'rgba(255, 255, 255, 0.55)',
    groundJoint: 'rgba(70, 100, 130, 0.2)',
    wallTop: '#f4f7fa',
    wallTopEdge: '#ffffff',
    wallFront: '#9fb2c4',
    wallBand: '#3fc1c9',
    stripeA: '#3fc1c9',
    stripeB: '#1d3b50',
    pillarStyle: 'lab',
    blockTop: '#f0b44c',
    blockFront: '#b87b1c',
    blockLine: '#c98e2a',
    blockBolt: '#6b4a12',
    blockStyle: 'metal',
    shadow: 'rgba(20, 40, 70, 0.22)',
  },
  // Dalles moussues, grès sculpté aux incrustations de jade, blocs de terre cuite.
  temple: {
    groundA: '#8fa38a',
    groundB: '#86997f',
    groundSpeck: 'rgba(40, 60, 40, 0.2)',
    groundLight: 'rgba(220, 240, 200, 0.18)',
    groundJoint: 'rgba(30, 50, 30, 0.28)',
    wallTop: '#c9b48a',
    wallTopEdge: '#dccb9f',
    wallFront: '#9a845a',
    wallBand: '#7a6644',
    stripeA: '#2f8f83',
    stripeB: '#c9b48a',
    pillarStyle: 'carved',
    blockTop: '#c0724a',
    blockFront: '#83442a',
    blockLine: '#8a4a2c',
    blockBolt: '#5a2c18',
    blockStyle: 'stone',
    shadow: 'rgba(10, 30, 20, 0.3)',
  },
  // Plaques de métal sombre, coque aux néons cyan, conteneurs de fret orange.
  station: {
    groundA: '#3a415b',
    groundB: '#343b54',
    groundSpeck: 'rgba(0, 0, 0, 0.25)',
    groundLight: 'rgba(140, 200, 255, 0.1)',
    groundJoint: 'rgba(120, 170, 255, 0.2)',
    wallTop: '#5a6380',
    wallTopEdge: '#7a84a3',
    wallFront: '#2b3148',
    wallBand: '#1a1f33',
    stripeA: '#28e0ff',
    stripeB: '#1a1f33',
    pillarStyle: 'hull',
    blockTop: '#e0873a',
    blockFront: '#a85a1d',
    blockLine: '#c46f28',
    blockBolt: '#5a2e0e',
    blockStyle: 'cargo',
    shadow: 'rgba(0, 0, 0, 0.35)',
  },
};

const TELEPORTER_COLORS = ['#35d6ff', '#ff4fd8', '#9dff5c'];

/**
 * Hauteur de la face avant des murs et caisses (vue 3/4), en fraction de case.
 * Chaque objet reste dans sa case : il ne masque jamais un personnage voisin.
 */
const DEPTH = 0.3;
const MAX_PARTICLES = 320;
const MAX_PIXEL_RATIO = 2;
/**
 * Étirement maximal d’une case pour remplir l’écran (1,45 : une case peut être
 * 45 % plus haute que large, ou l’inverse). Au-delà, l’arène est centrée.
 */
const MAX_STRETCH = 1.45;

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

/** Durée d'affichage d'un émoji au-dessus d'un personnage (ms). */
const EMOTE_MS = 2600;

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  /** Taille de référence d'une case : son plus petit côté. */
  private cell = 32;
  /** Émojis affichés au-dessus des personnages, par numéro de joueur. */
  private emotes = new Map<number, { emoji: string; at: number }>();
  /** Dimensions réelles d'une case à l'écran (elle peut être étirée). */
  private cellW = 32;
  private cellH = 32;
  private offsetX = 0;
  private offsetY = 0;
  private shakeX = 0;
  private shakeY = 0;
  private rotatedView = false;
  private theme: Theme = THEMES.chantier;
  /** Sol pré-dessiné, par arène : il ne change jamais pendant une manche. */
  private floor: HTMLCanvasElement | null = null;
  private floorKey = '';
  private particles: Particle[] = [];
  private shake = 0;
  private lastFrame = 0;
  /** État précédent, pour repérer explosions et blocs détruits entre deux images. */
  private previous: { roundNumber: number; rotated: boolean; tiles: Tile[]; bombs: Bomb[]; players: Player[] } | null = null;
  private readonly random = createRng(12345);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  /** Ajuste la résolution du canvas à sa taille affichée (écrans haute densité). */
  resize(width: number, height: number): void {
    // Au-delà de 2 pixels par point, la différence ne se voit pas mais coûte
    // cher en calcul et en batterie (un écran « 3x » a 2,25 fois plus de pixels).
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.floor = null;
  }

  /**
   * Vrai quand l'arène est affichée pivotée (écran plus haut que large) : les
   * directions du joystick et du clavier doivent alors être converties.
   */
  get rotated(): boolean {
    return this.rotatedView;
  }

  /** `you` : numéro du joueur de ce téléphone, signalé par un repère au-dessus de lui. */
  render(match: MatchState, you: number | null = null, now = performance.now()): void {
    const { ctx, canvas } = this;
    // Canvas encore caché (écran non affiché) : rien à dessiner.
    if (canvas.width === 0 || canvas.height === 0) return;
    // Écran en hauteur : on fait pivoter la vue pour que l'arène occupe la hauteur.
    this.rotatedView = canvas.height > canvas.width;
    const round = toScreenRound(match.round, this.rotatedView);
    this.fit(round);
    this.theme = THEMES[round.arena] ?? THEMES.chantier;
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.1) : 0;
    this.lastFrame = now;

    this.detectEvents(match.roundNumber, round);
    this.updateParticles(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.shakeX = 0;
    this.shakeY = 0;
    if (this.shake > 0) {
      const amplitude = this.cell * 0.06 * this.shake;
      this.shakeX = (this.random() - 0.5) * amplitude;
      this.shakeY = (this.random() - 0.5) * amplitude;
      this.shake = Math.max(0, this.shake - dt * 5);
    }

    // La manche est figée une fois terminée : on poursuit l'animation des
    // éliminations avec l'horloge de la phase.
    const frozen = match.phase === 'roundOver' || match.phase === 'matchOver';
    const tick = round.tick + (frozen ? match.phaseTick : 0);

    // Sol, murs et caisses s'étirent avec la case ; personnages, bombes et
    // bonus gardent leurs proportions.
    this.stretched();
    ctx.drawImage(this.floorLayer(round), 0, 0);
    this.drawFeatures(round, tick);
    for (let y = 0; y < round.height; y++) {
      for (let x = 0; x < round.width; x++) this.drawTile(round, x, y, tick);
    }
    this.upright();
    this.drawBonuses(round, tick);
    // Les flammes passent sur les caisses qui brûlent et les bonus, sous les personnages.
    this.stretched();
    this.drawFlames(round);
    this.drawToxic(round, tick);

    this.upright();
    for (const bomb of round.bombs) this.drawBomb(bomb, tick, bomb.owner === you);
    // Du fond vers l'avant : un personnage plus bas à l'écran passe devant.
    const players = [...round.players].sort((a, b) => a.y - b.y);
    for (const player of players) {
      this.drawPlayer(player, tick, player.id === you, match.skins?.[player.id] ?? 0, round.tick);
    }
    for (const player of players) this.drawEmote(player, now);

    this.drawParticles();
    this.drawSuddenDeathWarning(round);
  }

  /** Taille et position des cases pour remplir le canvas, dans la limite de l'étirement permis. */
  private fit(round: RoundState): void {
    const width = this.canvas.width / round.width;
    const height = this.canvas.height / round.height;
    this.cellW = Math.min(width, height * MAX_STRETCH);
    this.cellH = Math.min(height, width * MAX_STRETCH);
    this.cell = Math.min(this.cellW, this.cellH);
    this.offsetX = (this.canvas.width - this.cellW * round.width) / 2;
    this.offsetY = (this.canvas.height - this.cellH * round.height) / 2;
  }

  /** Repère « case carrée de côté `cell` », étiré aux dimensions réelles des cases. */
  private stretched(): void {
    this.ctx.setTransform(
      this.cellW / this.cell,
      0,
      0,
      this.cellH / this.cell,
      this.offsetX + this.shakeX,
      this.offsetY + this.shakeY,
    );
  }

  /** Repère non déformé : positions en `cellW`/`cellH`, tailles en `cell`. */
  private upright(): void {
    this.ctx.setTransform(1, 0, 0, 1, this.offsetX + this.shakeX, this.offsetY + this.shakeY);
  }

  // ---- Sol ----

  private floorLayer(round: RoundState): HTMLCanvasElement {
    const key = `${round.arena}:${round.width}x${round.height}:${this.cell}`;
    if (this.floor && this.floorKey === key) return this.floor;
    const t = this.theme;
    const layer = document.createElement('canvas');
    layer.width = Math.ceil(round.width * this.cell);
    layer.height = Math.ceil(round.height * this.cell);
    const ctx = layer.getContext('2d');
    if (!ctx) return layer;
    const cell = this.cell;
    const rng = createRng(7);
    for (let y = 0; y < round.height; y++) {
      for (let x = 0; x < round.width; x++) {
        const px = x * cell;
        const py = y * cell;
        ctx.fillStyle = (x + y) % 2 === 0 ? t.groundA : t.groundB;
        ctx.fillRect(px, py, cell + 1, cell + 1);
        // Graviers et reflets, toujours au même endroit grâce à la graine.
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = rng() < 0.7 ? t.groundSpeck : t.groundLight;
          const size = cell * (0.03 + rng() * 0.05);
          ctx.beginPath();
          ctx.arc(px + rng() * cell, py + rng() * cell, size, 0, Math.PI * 2);
          ctx.fill();
        }
        // Joint discret entre les dalles.
        ctx.fillStyle = t.groundJoint;
        ctx.fillRect(px, py + cell - 1, cell, 1);
        ctx.fillRect(px + cell - 1, py, 1, cell);
      }
    }
    this.floor = layer;
    this.floorKey = key;
    return layer;
  }

  // ---- Murs et caisses ----

  private drawTile(round: RoundState, x: number, y: number, tick: number): void {
    const tile = round.tiles[y * round.width + x];
    if (tile === Tile.Floor) return;
    if (tile === Tile.Pit) {
      this.drawPit(x, y, tick);
      return;
    }
    if (tile === Tile.Wall) {
      const border = x === 0 || y === 0 || x === round.width - 1 || y === round.height - 1;
      this.drawWall(x, y, border);
      return;
    }
    const burning = tile === Tile.Burning;
    const progress = burning ? 1 - round.flames[y * round.width + x] / FLAME_TICKS : 0;
    this.drawBlock(x, y, burning, progress);
  }

  private drawWall(x: number, y: number, border: boolean): void {
    const { ctx, cell, theme: t } = this;
    const px = x * cell;
    const py = y * cell;
    const depth = cell * DEPTH;

    // Ombre portée sur le sol, vers le bas à droite.
    ctx.fillStyle = t.shadow;
    ctx.fillRect(px + cell * 0.12, py + cell * 0.12, cell, cell - depth * 0.3);

    // Face avant, avec une bande : rayée sur la bordure, unie sur les piliers.
    ctx.fillStyle = t.wallFront;
    ctx.fillRect(px, py + cell - depth, cell, depth);
    const bandY = py + cell - depth * 0.72;
    const bandH = depth * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, bandY, cell, bandH);
    ctx.clip();
    ctx.fillStyle = border ? t.stripeA : t.wallBand;
    ctx.fillRect(px, bandY, cell, bandH);
    if (border) {
      ctx.fillStyle = t.stripeB;
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
    ctx.fillStyle = t.wallTop;
    ctx.fillRect(px, py, cell, topH);
    ctx.fillStyle = t.wallTopEdge;
    ctx.fillRect(px, py, cell, cell * 0.07);
    if (border) return;
    ctx.lineWidth = Math.max(1, cell * 0.04);
    switch (t.pillarStyle) {
      case 'formwork':
        // Plaque de coffrage et ses trous.
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.strokeRect(px + cell * 0.14, py + topH * 0.14, cell * 0.72, topH * 0.72);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        for (const [ox, oy] of [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]]) {
          ctx.beginPath();
          ctx.arc(px + cell * ox, py + topH * oy, cell * 0.035, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'lab':
        // Machine : écran turquoise et deux voyants.
        ctx.fillStyle = '#1d3b50';
        ctx.fillRect(px + cell * 0.2, py + topH * 0.2, cell * 0.6, topH * 0.45);
        ctx.fillStyle = t.wallBand;
        ctx.fillRect(px + cell * 0.26, py + topH * 0.28, cell * 0.48, topH * 0.08);
        ctx.fillRect(px + cell * 0.26, py + topH * 0.44, cell * 0.3, topH * 0.08);
        ctx.fillStyle = '#ff5a5a';
        ctx.beginPath();
        ctx.arc(px + cell * 0.3, py + topH * 0.82, cell * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5aff8a';
        ctx.beginPath();
        ctx.arc(px + cell * 0.44, py + topH * 0.82, cell * 0.04, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'carved':
        // Grès sculpté : disque de jade gravé.
        ctx.strokeStyle = 'rgba(80, 60, 30, 0.35)';
        ctx.strokeRect(px + cell * 0.1, py + topH * 0.1, cell * 0.8, topH * 0.8);
        ctx.fillStyle = t.stripeA;
        ctx.beginPath();
        ctx.arc(px + cell / 2, py + topH / 2, cell * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c9f2e8';
        ctx.beginPath();
        ctx.arc(px + cell / 2, py + topH / 2, cell * 0.09, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'hull':
        // Coque : plaque rivetée et liseré néon.
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.strokeRect(px + cell * 0.12, py + topH * 0.12, cell * 0.76, topH * 0.76);
        ctx.fillStyle = t.stripeA;
        ctx.fillRect(px + cell * 0.12, py + topH * 0.46, cell * 0.76, topH * 0.08);
        break;
    }
  }

  private drawBlock(x: number, y: number, burning: boolean, progress: number): void {
    const { ctx, cell, theme: t } = this;
    const inset = cell * (0.05 + progress * 0.28);
    const size = cell - inset * 2;
    const depth = size * DEPTH;
    const px = x * cell + inset;
    const py = y * cell + inset;
    ctx.globalAlpha = 1 - progress * 0.85;

    ctx.fillStyle = t.shadow;
    ctx.fillRect(px + size * 0.12, py + size * 0.14, size, size - depth * 0.3);

    ctx.fillStyle = burning ? '#6d3217' : t.blockFront;
    ctx.fillRect(px, py + size - depth, size, depth);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(px, py + size - depth * 0.5, size, 1);

    const topH = size - depth;
    ctx.fillStyle = burning ? '#b8521f' : t.blockTop;
    ctx.fillRect(px, py, size, topH);
    ctx.strokeStyle = burning ? '#7a3313' : t.blockLine;
    ctx.fillStyle = t.blockBolt;
    ctx.lineWidth = Math.max(1, cell * 0.045);
    const bolts = (points: number[][]) => {
      for (const [ox, oy] of points) {
        ctx.beginPath();
        ctx.arc(px + size * ox, py + topH * oy, size * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    switch (t.blockStyle) {
      case 'crate':
        // Planches et croisillon.
        ctx.strokeRect(px + size * 0.06, py + topH * 0.08, size * 0.88, topH * 0.84);
        ctx.beginPath();
        ctx.moveTo(px + size * 0.1, py + topH * 0.12);
        ctx.lineTo(px + size * 0.9, py + topH * 0.88);
        ctx.moveTo(px + size * 0.9, py + topH * 0.12);
        ctx.lineTo(px + size * 0.1, py + topH * 0.88);
        ctx.stroke();
        bolts([[0.12, 0.14], [0.88, 0.14], [0.12, 0.86], [0.88, 0.86]]);
        break;
      case 'metal':
        // Conteneur : couvercle rainuré et rivets.
        ctx.strokeRect(px + size * 0.1, py + topH * 0.12, size * 0.8, topH * 0.76);
        ctx.beginPath();
        ctx.moveTo(px + size * 0.1, py + topH * 0.5);
        ctx.lineTo(px + size * 0.9, py + topH * 0.5);
        ctx.stroke();
        bolts([[0.18, 0.22], [0.82, 0.22], [0.18, 0.78], [0.82, 0.78]]);
        break;
      case 'stone':
        // Bloc de pierre fissuré.
        ctx.beginPath();
        ctx.moveTo(px + size * 0.18, py + topH * 0.2);
        ctx.lineTo(px + size * 0.42, py + topH * 0.46);
        ctx.lineTo(px + size * 0.36, py + topH * 0.8);
        ctx.moveTo(px + size * 0.42, py + topH * 0.46);
        ctx.lineTo(px + size * 0.78, py + topH * 0.38);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(px, py, size, topH * 0.12);
        break;
      case 'cargo':
        // Conteneur de fret : nervures verticales.
        for (const ox of [0.25, 0.5, 0.75]) {
          ctx.beginPath();
          ctx.moveTo(px + size * ox, py + topH * 0.1);
          ctx.lineTo(px + size * ox, py + topH * 0.9);
          ctx.stroke();
        }
        bolts([[0.1, 0.12], [0.9, 0.12], [0.1, 0.88], [0.9, 0.88]]);
        break;
    }
    ctx.globalAlpha = 1;
  }

  /** Dalle effondrée : bassin d'eau sombre qui ondule. */
  private drawPit(x: number, y: number, tick: number): void {
    const { ctx, cell } = this;
    const px = x * cell;
    const py = y * cell;
    ctx.fillStyle = '#1f4e63';
    ctx.fillRect(px, py, cell, cell);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(px, py, cell, cell * 0.22);
    ctx.strokeStyle = 'rgba(160, 230, 255, 0.35)';
    ctx.lineWidth = Math.max(1, cell * 0.035);
    const phase = (tick * 0.03 + x * 0.7 + y * 0.3) % 1;
    ctx.beginPath();
    ctx.ellipse(px + cell / 2, py + cell * 0.6, cell * (0.12 + phase * 0.3), cell * (0.05 + phase * 0.12), 0, 0, Math.PI * 2);
    ctx.globalAlpha = 1 - phase;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- Éléments au sol : téléporteurs, tapis roulants, dalles fissurées ----

  private drawFeatures(round: RoundState, tick: number): void {
    const { ctx, cell } = this;
    // Chaque paire de téléporteurs a sa couleur.
    const pairColor = new Map<number, string>();
    for (let index = 0; index < round.features.length; index++) {
      const feature = round.features[index];
      if (feature === Feature.None) continue;
      const x = index % round.width;
      const y = Math.floor(index / round.width);
      const px = x * cell;
      const py = y * cell;
      const cx = px + cell / 2;
      const cy = py + cell / 2;

      if (feature === Feature.Teleporter) {
        const key = Math.min(index, round.teleportTargets[index]);
        if (!pairColor.has(key)) pairColor.set(key, TELEPORTER_COLORS[pairColor.size % TELEPORTER_COLORS.length]);
        const color = pairColor.get(key) ?? TELEPORTER_COLORS[0];
        ctx.fillStyle = '#26303f';
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.42, 0, Math.PI * 2);
        ctx.fill();
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.36);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.35, color);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, cell * 0.06);
        const angle = tick * 0.08;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(cx, cy, cell * 0.4, angle + (i * Math.PI * 2) / 3, angle + (i * Math.PI * 2) / 3 + 1.2);
          ctx.stroke();
        }
        continue;
      }

      const conveyor = CONVEYOR_DIRECTIONS[feature];
      if (conveyor) {
        const [dx, dy] = DIRECTION_VECTORS[conveyor];
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, cell, cell);
        ctx.clip();
        ctx.fillStyle = '#20263a';
        ctx.fillRect(px, py + cell * 0.08, cell, cell * 0.84);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(px, py + cell * 0.08, cell, cell * 0.08);
        // Chevrons qui défilent dans le sens du tapis.
        ctx.strokeStyle = '#f5c211';
        ctx.lineWidth = Math.max(1.5, cell * 0.08);
        const shift = ((tick * 0.03) % 1) * cell * 0.5;
        for (let k = -2; k <= 2; k++) {
          const offset = k * cell * 0.5 + shift;
          const ox = cx + dx * offset;
          const oy = cy + dy * offset;
          ctx.beginPath();
          ctx.moveTo(ox - dx * cell * 0.12 - dy * cell * 0.2, oy - dy * cell * 0.12 - dx * cell * 0.2);
          ctx.lineTo(ox + dx * cell * 0.08, oy + dy * cell * 0.08);
          ctx.lineTo(ox - dx * cell * 0.12 + dy * cell * 0.2, oy - dy * cell * 0.12 + dx * cell * 0.2);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }

      if (feature === Feature.Cracked) {
        const stepped = round.steppedOn[index] === 1;
        ctx.fillStyle = stepped ? 'rgba(40, 20, 0, 0.25)' : 'rgba(40, 20, 0, 0.1)';
        ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        ctx.strokeStyle = stepped ? 'rgba(30, 15, 0, 0.8)' : 'rgba(30, 15, 0, 0.5)';
        ctx.lineWidth = Math.max(1, cell * 0.045);
        ctx.beginPath();
        ctx.moveTo(px + cell * 0.15, py + cell * 0.25);
        ctx.lineTo(px + cell * 0.45, py + cell * 0.45);
        ctx.lineTo(px + cell * 0.4, py + cell * 0.85);
        ctx.moveTo(px + cell * 0.45, py + cell * 0.45);
        ctx.lineTo(px + cell * 0.85, py + cell * 0.3);
        ctx.moveTo(px + cell * 0.6, py + cell * 0.4);
        ctx.lineTo(px + cell * 0.75, py + cell * 0.8);
        ctx.stroke();
      }
    }
  }

  private drawBonuses(round: RoundState, tick: number): void {
    const { ctx, cell, cellW, cellH } = this;
    for (let index = 0; index < round.bonuses.length; index++) {
      const bonus = round.bonuses[index];
      if (bonus === Bonus.None) continue;
      const cx = ((index % round.width) + 0.5) * cellW;
      const cy = (Math.floor(index / round.width) + 0.5) * cellH;
      const bob = Math.sin(tick * 0.1 + index) * cell * 0.04;
      ctx.fillStyle = this.theme.shadow;
      ctx.beginPath();
      ctx.ellipse(cx, cy + cell * 0.3, cell * 0.26, cell * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      drawBonusIcon(ctx, bonus, cx, cy - cell * 0.04 + bob, cell * 0.6);
    }
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

  /** `mine` : bombe de ce téléphone (son propre leurre lui apparaît comme tel). */
  private drawBomb(bomb: Bomb, tick: number, mine: boolean): void {
    const { ctx, cell, cellW, cellH } = this;
    if (bomb.decoy && mine) ctx.globalAlpha = 0.5;
    // Bombe poussée : elle glisse entre deux cases.
    const [sx, sy] = bomb.slide ? DIRECTION_VECTORS[bomb.slide] : [0, 0];
    const cx = (bomb.cx + sx * bomb.slideProgress + 0.5) * cellW;
    const cy = (bomb.cy + sy * bomb.slideProgress + 0.5) * cellH;
    // Pulsation qui s'accélère à l'approche de l'explosion (sauf bombe télécommandée).
    const urgency = bomb.remote ? 0 : 1 - bomb.fuse / BOMB_FUSE_TICKS;
    const pulse = 1 + 0.08 * Math.sin(tick * (0.15 + urgency * 0.5));
    const radius = cell * 0.36 * pulse;

    ctx.fillStyle = this.theme.shadow;
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

    ctx.fillStyle = '#3a3d4a';
    ctx.fillRect(cx + radius * 0.25, cy - radius * 1.05, radius * 0.4, radius * 0.32);
    if (bomb.remote) {
      // Bombe télécommandée : antenne et voyant rouge au lieu de la mèche.
      ctx.strokeStyle = '#9aa0b0';
      ctx.lineWidth = Math.max(1, cell * 0.035);
      ctx.beginPath();
      ctx.moveTo(cx + radius * 0.45, cy - radius * 1.02);
      ctx.lineTo(cx + radius * 0.6, cy - radius * 1.7);
      ctx.stroke();
      ctx.fillStyle = Math.floor(tick / 10) % 2 === 0 ? '#ff3b30' : '#7a1a15';
      ctx.beginPath();
      ctx.arc(cx + radius * 0.6, cy - radius * 1.7, cell * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    // Mèche et étincelle.
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
    if (bomb.decoy && mine) {
      // Pour Boomette seule : un cœur rose signale son leurre.
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff8cc6';
      ctx.font = `${Math.round(cell * 0.34)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', cx, cy + radius * 0.1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- Pouvoirs ----

  /** Nuages toxiques de Toxic : nappes vertes qui bouillonnent. */
  private drawToxic(round: RoundState, tick: number): void {
    if (!round.toxic) return;
    const { ctx, cell } = this;
    for (let i = 0; i < round.toxic.length; i++) {
      const left = round.toxic[i];
      if (left <= 0) continue;
      const x = (i % round.width) * cell;
      const y = Math.floor(i / round.width) * cell;
      const fade = Math.min(1, left / 30);
      ctx.fillStyle = `rgba(110, 220, 60, ${0.32 * fade})`;
      ctx.fillRect(x + cell * 0.04, y + cell * 0.04, cell * 0.92, cell * 0.92);
      ctx.fillStyle = `rgba(200, 255, 120, ${0.55 * fade})`;
      for (let b = 0; b < 3; b++) {
        const phase = (tick * 0.05 + b * 2.1 + i) % 3;
        const bx = x + cell * (0.25 + 0.25 * b);
        const by = y + cell * (0.8 - phase * 0.22);
        ctx.beginPath();
        ctx.arc(bx, by, cell * (0.05 + 0.03 * Math.sin(phase)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Effets de pouvoir autour d'un personnage (sous et sur lui). */
  private drawPowerAura(player: Player, cx: number, cy: number, r: number, roundTick: number, tick: number): void {
    const { ctx, cell } = this;
    const active = player.effect !== undefined && player.effect !== -1 && player.effectUntil > roundTick;
    if (!active) return;
    if (player.effect === Hero.Boomer || player.effect === Hero.Toxic) {
      const color = player.effect === Hero.Boomer ? '255, 150, 40' : '120, 230, 60';
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.3);
      const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.6);
      glow.addColorStop(0, `rgba(${color}, ${0.35 + 0.2 * pulse})`);
      glow.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
    } else if (player.effect === Hero.Rocket) {
      // Traînée derrière Rocket pendant son Dash.
      const [dx, dy] = DIRECTION_VECTORS[player.facing];
      for (let k = 1; k <= 3; k++) {
        ctx.fillStyle = `rgba(255, 170, 60, ${0.4 - k * 0.1})`;
        ctx.beginPath();
        ctx.arc(cx - dx * cell * 0.35 * k, cy - dy * cell * 0.35 * k, r * (0.8 - k * 0.15), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawPowerOverlay(player: Player, cx: number, cy: number, r: number, roundTick: number): void {
    const { ctx, cell } = this;
    if (player.effect === Hero.Rocco && player.effectUntil > roundTick) {
      // Carapace de pierre de Rocco.
      ctx.strokeStyle = 'rgba(190, 195, 205, 0.95)';
      ctx.fillStyle = 'rgba(120, 124, 132, 0.28)';
      ctx.lineWidth = Math.max(2, cell * 0.08);
      ctx.setLineDash([cell * 0.14, cell * 0.08]);
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.05, r * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (player.frozenUntil > roundTick) {
      // Bloc de glace de Frost.
      const w = r * 2.3;
      const h = r * 2.5;
      ctx.fillStyle = 'rgba(170, 225, 255, 0.45)';
      ctx.strokeStyle = 'rgba(235, 250, 255, 0.95)';
      ctx.lineWidth = Math.max(1.5, cell * 0.05);
      ctx.beginPath();
      // `roundRect` manque sur les iPhone plus anciens (avant iOS 16).
      if (typeof ctx.roundRect === 'function') ctx.roundRect(cx - w / 2, cy - h * 0.6, w, h, r * 0.3);
      else ctx.rect(cx - w / 2, cy - h * 0.6, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.3, cy - h * 0.45);
      ctx.lineTo(cx - w * 0.1, cy - h * 0.25);
      ctx.stroke();
    }
  }

  // ---- Personnages ----

  private drawPlayer(player: Player, tick: number, isYou: boolean, skin: number, roundTick: number): void {
    const { ctx, cell, cellW, cellH } = this;
    const look = lookFor(player.character ?? defaultCharacter(player.id), skin);
    let alpha = 1;
    let scale = 1;
    if (!player.alive) {
      const since = tick - (player.diedAt ?? tick);
      alpha = Math.max(0, 1 - since / 40);
      scale = 1 + since / 60;
      if (alpha <= 0) return;
    }
    const bob = player.moving && player.alive ? Math.abs(Math.sin(tick * 0.35)) * cell * 0.06 : 0;
    const cx = player.x * cellW;
    const groundY = player.y * cellH;
    const cy = groundY - cell * 0.08 - bob;
    const r = cell * 0.36 * scale;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.theme.shadow;
    ctx.beginPath();
    ctx.ellipse(cx, groundY + r * 0.8, r * 0.8, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isYou && player.alive) {
      // Anneau au sol aux couleurs du joueur.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, cell * 0.05);
      ctx.beginPath();
      ctx.ellipse(cx, groundY + r * 0.8, r * 0.95, r * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (player.alive) this.drawPowerAura(player, cx, cy, r, roundTick, tick);
    // Invulnérable juste après avoir perdu le gilet : le personnage clignote.
    if (player.alive && tick < player.invulnerableUntil && Math.floor(tick / 5) % 2 === 0) ctx.globalAlpha = 0.35;
    drawCharacter(ctx, look, cx, cy, r, player.facing);
    if (player.alive) this.drawPowerOverlay(player, cx, cy, r, roundTick);
    if (player.alive && player.vest) {
      // Gilet pare-flamme : bulle protectrice.
      ctx.fillStyle = 'rgba(120, 220, 255, 0.14)';
      ctx.strokeStyle = 'rgba(120, 220, 255, 0.85)';
      ctx.lineWidth = Math.max(1.5, cell * 0.045);
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.05, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (isYou && player.alive) this.drawYouMarker(cx, cy - r * 1.55, tick);
  }

  /** Émoji envoyé par un joueur : une bulle au-dessus de son personnage pendant quelques secondes. */
  showEmote(seat: number, emoji: string, now = performance.now()): void {
    this.emotes.set(seat, { emoji, at: now });
  }

  private drawEmote(player: Player, now: number): void {
    const emote = this.emotes.get(player.id);
    if (!emote) return;
    // L'horloge des images peut être un peu en retard sur celle de l'arrivée de l'émoji.
    const age = Math.max(0, now - emote.at);
    if (age > EMOTE_MS || !player.alive) {
      this.emotes.delete(player.id);
      return;
    }
    const { ctx, cell, cellW, cellH } = this;
    // Apparition avec rebond, disparition en fondu.
    const pop = Math.min(1, age / 180);
    const scale = pop < 1 ? pop * 1.15 : 1 + Math.max(0, 0.15 - (age - 180) / 1000);
    const alpha = Math.min(1, (EMOTE_MS - age) / 300);
    const size = Math.max(22, cell * 0.62) * scale;
    const x = player.x * cellW;
    const y = Math.max(size * 0.6, player.y * cellH - cell * 1.05 - size * 0.35);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#15161f';
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(size * 0.78)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emote.emoji, x, y + size * 0.04);
    ctx.globalAlpha = 1;
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

  /** Compare avec l'image précédente (dans le repère de l'écran) pour lancer les effets. */
  private detectEvents(roundNumber: number, round: RoundState): void {
    const previous = this.previous;
    const rotated = this.rotatedView;
    this.previous = { roundNumber, rotated, tiles: [...round.tiles], bombs: round.bombs, players: round.players };
    if (!previous || previous.roundNumber !== roundNumber || previous.rotated !== rotated) {
      this.particles = [];
      return;
    }
    const { cellW, cellH } = this;
    for (const player of round.players) {
      const before = previous.players[player.id];
      if (!before || !player.alive || player.powerReadyAt === undefined || player.powerReadyAt <= before.powerReadyAt) continue;
      // Pouvoir utilisé : éclat aux couleurs du personnage (du pouvoir copié, pour Omega).
      const power = player.effect !== -1 && player.effectUntil > round.tick ? player.effect : player.character;
      const x = player.x * cellW;
      const y = player.y * cellH;
      this.emit(x, y, 16, [HERO_COLORS[power] ?? '#ffffff', '#ffffff'], 2.6, 0.55, 0);
      if (player.character === Hero.Frost || power === Hero.Frost) {
        // Onde de froid jusqu'à la portée du Gel.
        for (let k = 0; k < 28; k++) {
          const angle = (k / 28) * Math.PI * 2;
          this.emit(x + Math.cos(angle) * FREEZE_RADIUS * cellW, y + Math.sin(angle) * FREEZE_RADIUS * cellH, 1, ['#dff3ff', '#8fd3ff'], 0.4, 0.6, 0);
        }
      }
    }
    for (const bomb of previous.bombs) {
      if (round.bombs.some((other) => other.id === bomb.id)) continue;
      if (bomb.decoy) {
        // Le leurre de Boomette disparaît dans un petit nuage rose.
        this.emit((bomb.cx + 0.5) * cellW, (bomb.cy + 0.5) * cellH, 12, ['#ffb3da', '#ff8cc6', '#ffffff'], 1.4, 0.7, -0.3);
        continue;
      }
      if (round.flames[bomb.cy * round.width + bomb.cx] <= 0) continue; // murée par le resserrement
      this.shake = 1;
      this.emit((bomb.cx + 0.5) * cellW, (bomb.cy + 0.5) * cellH, 18, ['#fff3a0', '#ffb52e', '#ff6a1f'], 3.2, 0.5, 0);
      this.emit((bomb.cx + 0.5) * cellW, (bomb.cy + 0.3) * cellH, 6, ['rgba(70,64,60,0.55)', 'rgba(110,100,92,0.45)'], 0.9, 1.1, -0.4);
    }
    for (let i = 0; i < round.tiles.length; i++) {
      if (previous.tiles[i] === Tile.Block && round.tiles[i] === Tile.Burning) {
        const x = ((i % round.width) + 0.5) * cellW;
        const y = (Math.floor(i / round.width) + 0.3) * cellH;
        this.emit(x, y, 10, [this.theme.blockTop, this.theme.blockFront, this.theme.blockLine], 2.4, 0.9, 6);
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
    const { ctx } = this;
    if (Math.floor(round.tick / 15) % 2 === 0) {
      ctx.strokeStyle = 'rgba(255, 60, 40, 0.8)';
      ctx.lineWidth = this.cell * 0.2;
      ctx.strokeRect(0, 0, round.width * this.cellW, round.height * this.cellH);
    }
  }
}
