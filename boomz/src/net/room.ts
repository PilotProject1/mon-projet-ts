import { SKIN_COUNT, TICK_RATE } from '../game/constants';
import { createMatch, stepMatch, type ArenaChoice, type MatchState } from '../game/match';
import { eliminatePlayer } from '../game/round';
import type { Direction, PlayerInput, RoundEvent } from '../game/types';
import { MAX_PLAYERS, MIN_PLAYERS, RECONNECT_GRACE_SECONDS, SNAPSHOT_EVERY_TICKS, type ServerMessage } from './protocol';

/** Statistiques de jeu tenues par le serveur en ligne (voir server/stats.ts). */
export interface RoomStats {
  recordMatchStart(playerCount: number): void;
  recordEvents(events: RoundEvent[]): void;
  recordRoundEnd(match: MatchState): void;
}

const GRACE_TICKS = RECONNECT_GRACE_SECONDS * TICK_RATE;

/**
 * État envoyé aux téléphones. Les bonus cachés sous les caisses restent sur le
 * serveur (sinon un joueur pourrait les lire) ; l'ordre du resserrement ne sert
 * qu'au serveur.
 */
function snapshotMessage(match: MatchState): ServerMessage {
  return {
    type: 'snapshot',
    match: { ...match, round: { ...match.round, suddenDeathOrder: [], hiddenBonuses: [] } },
  };
}

export interface Peer {
  id: string;
  /** Secret connu du seul téléphone du joueur, pour reprendre sa place. */
  token: string;
  name: string;
  connected: boolean;
  ready: boolean;
  /** Apparence choisie (cosmétique). */
  skin: number;
  /** Horloge du salon au moment de la coupure. */
  disconnectedAt: number | null;
  send(message: ServerMessage): void;
}

export function createPeer(id: string, token: string, name: string, send: (message: ServerMessage) => void): Peer {
  return { id, token, name, connected: true, ready: false, skin: 0, disconnectedAt: null, send };
}

/**
 * Un salon : ses joueurs, et la partie qu'il héberge. Celui qui l'héberge (le
 * serveur en ligne, ou le téléphone hôte d'une partie sans internet) fait
 * autorité : il est seul à faire avancer la simulation, les téléphones
 * n'envoient que leurs commandes et affichent l'état reçu.
 */
export class Room {
  readonly code: string;
  private hostId: string | null = null;
  private peers: Peer[] = [];
  private match: MatchState | null = null;
  /** Numéro de joueur dans la partie en cours, par identifiant. */
  private seats = new Map<string, number>();
  private directions: Array<Direction | null> = [];
  private pendingBombs: boolean[] = [];
  private pendingDetonations: boolean[] = [];
  private arena: ArenaChoice = 'rotation';
  private clock = 0;
  private matchTicks = 0;
  private readonly randomSeed: () => number;
  private readonly stats: RoomStats | null;

  constructor(
    code: string,
    randomSeed: () => number = () => Math.floor(Math.random() * 2 ** 31),
    stats: RoomStats | null = null,
  ) {
    this.code = code;
    this.randomSeed = randomSeed;
    this.stats = stats;
  }

  get isEmpty(): boolean {
    return this.peers.length === 0;
  }

  private get inMatch(): boolean {
    return this.match !== null && this.match.phase !== 'matchOver';
  }

  join(peer: Peer): string | null {
    if (this.inMatch) return 'La partie a déjà commencé dans ce salon.';
    if (this.peers.length >= MAX_PLAYERS) return `Ce salon est complet (${MAX_PLAYERS} joueurs maximum).`;
    this.peers.push(peer);
    this.hostId ??= peer.id;
    peer.send({ type: 'welcome', room: this.code, you: peer.id, token: peer.token });
    this.broadcastLobby();
    if (this.match) peer.send(snapshotMessage(this.match));
    return null;
  }

  /** Rattache un téléphone revenu après une coupure à sa place. */
  resume(token: string, send: (message: ServerMessage) => void): Peer | null {
    const peer = this.peers.find((candidate) => candidate.token === token);
    if (!peer) return null;
    peer.connected = true;
    peer.disconnectedAt = null;
    peer.send = send;
    peer.send({ type: 'welcome', room: this.code, you: peer.id, token: peer.token });
    this.broadcastLobby();
    if (this.match) peer.send(snapshotMessage(this.match));
    return peer;
  }

  /** Connexion perdue : la place est gardée le temps de la période de grâce. */
  disconnect(peerId: string): void {
    const peer = this.peers.find((candidate) => candidate.id === peerId);
    if (!peer || !peer.connected) return;
    peer.connected = false;
    peer.disconnectedAt = this.clock;
    const seat = this.seats.get(peerId);
    if (seat !== undefined) this.directions[seat] = null;
    this.broadcastLobby();
  }

  /** Départ volontaire : la place est libérée tout de suite. */
  leave(peerId: string): void {
    const peer = this.peers.find((candidate) => candidate.id === peerId);
    if (!peer) return;
    this.remove(peer);
    this.broadcastLobby();
  }

  setReady(peerId: string, ready: boolean): void {
    const peer = this.peers.find((candidate) => candidate.id === peerId);
    if (!peer || this.inMatch) return;
    peer.ready = ready;
    this.broadcastLobby();
  }

  setSkin(peerId: string, skin: number): void {
    const peer = this.peers.find((candidate) => candidate.id === peerId);
    if (!peer || this.inMatch || !Number.isInteger(skin) || skin < 0 || skin >= SKIN_COUNT) return;
    peer.skin = skin;
    this.broadcastLobby();
  }

  setArena(peerId: string, arena: ArenaChoice): void {
    if (peerId !== this.hostId || this.inMatch) return;
    this.arena = arena;
    this.broadcastLobby();
  }

  start(peerId: string): string | null {
    if (peerId !== this.hostId) return 'Seul l’hôte peut lancer la partie.';
    if (this.inMatch) return 'La partie est déjà en cours.';
    const present = this.peers.filter((peer) => peer.connected);
    if (present.length !== this.peers.length) return 'Un joueur est en cours de reconnexion.';
    if (present.length < MIN_PLAYERS) return `Il faut au moins ${MIN_PLAYERS} joueurs.`;
    if (present.some((peer) => peer.id !== this.hostId && !peer.ready)) return 'Tous les joueurs ne sont pas prêts.';
    this.seats = new Map(this.peers.map((peer, seat) => [peer.id, seat]));
    this.directions = this.peers.map(() => null);
    this.pendingBombs = this.peers.map(() => false);
    this.pendingDetonations = this.peers.map(() => false);
    for (const peer of this.peers) peer.ready = false;
    this.match = createMatch(this.peers.length, this.randomSeed(), this.arena);
    this.match.skins = this.peers.map((peer) => peer.skin);
    this.stats?.recordMatchStart(this.peers.length);
    this.matchTicks = 0;
    this.broadcastLobby();
    this.broadcast(snapshotMessage(this.match));
    return null;
  }

  setDirection(peerId: string, direction: Direction | null): void {
    const seat = this.seats.get(peerId);
    if (seat !== undefined && this.inMatch) this.directions[seat] = direction;
  }

  requestBomb(peerId: string): void {
    const seat = this.seats.get(peerId);
    if (seat !== undefined && this.inMatch) this.pendingBombs[seat] = true;
  }

  requestDetonation(peerId: string): void {
    const seat = this.seats.get(peerId);
    if (seat !== undefined && this.inMatch) this.pendingDetonations[seat] = true;
  }

  tick(): void {
    this.clock++;
    this.expireDisconnected();

    const match = this.match;
    if (!match || match.phase === 'matchOver') return;

    // Un joueur dont la place est perdue, ou qui a quitté, est éliminé.
    for (const [peerId, seat] of this.seats) {
      if (!this.peers.some((peer) => peer.id === peerId)) eliminatePlayer(match.round, seat);
    }

    const inputs: PlayerInput[] = this.directions.map((direction, seat) => ({
      direction,
      bomb: this.pendingBombs[seat],
      detonate: this.pendingDetonations[seat],
    }));
    // Une commande reçue pendant le compte à rebours est ignorée, pas mise en réserve.
    this.pendingBombs.fill(false);
    this.pendingDetonations.fill(false);
    const wasPlaying = match.phase === 'playing';
    const events = stepMatch(match, inputs);
    this.stats?.recordEvents(events);
    this.matchTicks++;
    if (wasPlaying && (match as MatchState).phase !== 'playing') this.stats?.recordRoundEnd(match);

    // `stepMatch` a pu changer la phase : on relit l'état au lieu de se fier au test précédent.
    const ended = (match as MatchState).phase === 'matchOver';
    if (ended || this.matchTicks % SNAPSHOT_EVERY_TICKS === 0) this.broadcast(snapshotMessage(match));
    if (ended) this.broadcastLobby();
  }

  private expireDisconnected(): void {
    const expired = this.peers.filter(
      (peer) => !peer.connected && peer.disconnectedAt !== null && this.clock - peer.disconnectedAt >= GRACE_TICKS,
    );
    if (expired.length === 0) return;
    for (const peer of expired) this.remove(peer);
    this.broadcastLobby();
  }

  private remove(peer: Peer): void {
    this.peers = this.peers.filter((candidate) => candidate !== peer);
    if (this.hostId === peer.id) {
      this.hostId = (this.peers.find((candidate) => candidate.connected) ?? this.peers[0])?.id ?? null;
    }
  }

  private broadcastLobby(): void {
    this.broadcast({
      type: 'lobby',
      host: this.hostId ?? '',
      players: this.peers.map(({ id, name, connected, ready, skin }) => ({ id, name, connected, ready, skin })),
      seats: Object.fromEntries(this.seats),
      inMatch: this.inMatch,
      arena: this.arena,
    });
  }

  private broadcast(message: ServerMessage): void {
    for (const peer of this.peers) if (peer.connected) peer.send(message);
  }
}
