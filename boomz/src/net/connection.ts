import type { MatchState } from '../game/match';
import { DIRECTION_VECTORS, type Bomb } from '../game/types';
import { TICK_RATE } from '../game/constants';
import { SNAPSHOT_EVERY_TICKS, WS_PATH, type ClientMessage, type ServerMessage } from './protocol';
import { websocketUrl } from './server';

export class Connection {
  private readonly socket: WebSocket;
  private readonly queue: ClientMessage[] = [];

  constructor(onMessage: (message: ServerMessage) => void, onClose: () => void) {
    this.socket = new WebSocket(websocketUrl(WS_PATH));
    this.socket.addEventListener('open', () => {
      for (const message of this.queue.splice(0)) this.socket.send(JSON.stringify(message));
    });
    this.socket.addEventListener('message', (event) => onMessage(JSON.parse(String(event.data))));
    this.socket.addEventListener('close', onClose);
  }

  send(message: ClientMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
    else if (this.socket.readyState === WebSocket.CONNECTING) this.queue.push(message);
  }

  close(): void {
    this.socket.close();
  }
}

/**
 * L'affichage a un léger retard sur le dernier état reçu, pour toujours
 * disposer de deux états entre lesquels interpoler : les personnages glissent
 * au lieu de sauter d'une position à l'autre à chaque envoi du serveur.
 */
const INTERPOLATION_DELAY_MS = 100;
/**
 * Connexion irrégulière (Bluetooth, réseau mobile) : le retard s'allonge d'autant
 * que les états arrivent en retard, jusqu'à cette limite, puis se résorbe.
 */
const MAX_INTERPOLATION_DELAY_MS = 260;
/** Écart normal entre deux états (20 par seconde). */
const EXPECTED_GAP_MS = (SNAPSHOT_EVERY_TICKS * 1000) / TICK_RATE;
const BUFFER_SIZE = 30;

interface TimedSnapshot {
  at: number;
  match: MatchState;
}

export class SnapshotBuffer {
  private snapshots: TimedSnapshot[] = [];
  private lastSeq = 0;
  /** Retard récent des états sur leur rythme normal (ms), qui s'estompe peu à peu. */
  private lateness = 0;

  /** `seq` : numéro d'envoi ; un état plus ancien que le dernier reçu est écarté. */
  push(match: MatchState, at: number, seq?: number): void {
    if (seq !== undefined) {
      if (seq <= this.lastSeq) return;
      this.lastSeq = seq;
    }
    const previous = this.snapshots[this.snapshots.length - 1];
    if (previous) this.lateness = Math.max(at - previous.at - EXPECTED_GAP_MS, this.lateness * 0.97);
    this.snapshots.push({ at, match });
    if (this.snapshots.length > BUFFER_SIZE) this.snapshots.shift();
  }

  clear(): void {
    this.snapshots = [];
    this.lastSeq = 0;
    this.lateness = 0;
  }

  /** Nouvelle connexion (le serveur a pu redémarrer) : la numérotation des états repart de zéro. */
  restartSequence(): void {
    this.lastSeq = 0;
  }

  /** Retard d'affichage actuel : plus long quand la connexion est irrégulière. */
  get delay(): number {
    return Math.min(MAX_INTERPOLATION_DELAY_MS, INTERPOLATION_DELAY_MS + this.lateness);
  }

  latest(): MatchState | null {
    return this.snapshots[this.snapshots.length - 1]?.match ?? null;
  }

  /** État à afficher à l'instant `now`, positions interpolées. */
  sample(now: number): MatchState | null {
    const target = now - this.delay;
    const index = this.snapshots.findIndex((snapshot) => snapshot.at > target);
    if (index === -1) return this.latest();
    if (index === 0) return this.snapshots[0].match;
    const before = this.snapshots[index - 1];
    const after = this.snapshots[index];
    // Pas d'interpolation d'une manche à l'autre : l'arène a changé.
    if (before.match.roundNumber !== after.match.roundNumber) return after.match;
    const t = (target - before.at) / (after.at - before.at);
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const round = after.match.round;
    return {
      ...after.match,
      round: {
        ...round,
        tick: lerp(before.match.round.tick, round.tick),
        players: round.players.map((player, id) => {
          const previous = before.match.round.players[id];
          // Un joueur éliminé reste figé là où il a été touché.
          if (!previous || !player.alive) return player;
          return { ...player, x: lerp(previous.x, player.x), y: lerp(previous.y, player.y) };
        }),
        bombs: round.bombs.map((bomb) => interpolateBomb(before.match.round.bombs, bomb, lerp)),
      },
    };
  }
}

/** Bombe poussée (Kick) : sa position glisse d'un état à l'autre au lieu d'avancer par à-coups. */
function interpolateBomb(previousBombs: Bomb[], bomb: Bomb, lerp: (a: number, b: number) => number): Bomb {
  const previous = previousBombs.find((candidate) => candidate.id === bomb.id);
  const direction = bomb.slide ?? previous?.slide;
  if (!previous || !direction) return bomb;
  const [dx, dy] = DIRECTION_VECTORS[direction];
  // Position le long de l'axe du glissement, avant et après.
  const along = (candidate: Bomb) =>
    candidate.cx * dx + candidate.cy * dy + (candidate.slide ? candidate.slideProgress : 0);
  const base = bomb.cx * dx + bomb.cy * dy;
  return { ...bomb, slide: direction, slideProgress: lerp(along(previous), along(bomb)) - base };
}
