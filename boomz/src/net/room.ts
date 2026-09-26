import { SKIN_COUNT, TICK_RATE } from '../game/constants';
import { createMatch, stepMatch, type ArenaChoice, type MatchState } from '../game/match';
import { BotBrain, type BotLevel } from '../game/bot';
import { createRng } from '../game/rng';
import { eliminatePlayer } from '../game/round';
import type { Direction, PlayerInput, RoundEvent } from '../game/types';
import {
  EMOTES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RECONNECT_GRACE_SECONDS,
  SNAPSHOT_EVERY_TICKS,
  type IceServer,
  type ServerMessage,
  type VoiceSignal,
} from './protocol';

/** Statistiques de jeu tenues par le serveur en ligne (voir server/stats.ts). */
export interface RoomStats {
  recordMatchStart(playerCount: number): void;
  recordEvents(events: RoundEvent[]): void;
  recordRoundEnd(match: MatchState): void;
}

const GRACE_TICKS = RECONNECT_GRACE_SECONDS * TICK_RATE;
/** Au plus un émoji par joueur toutes les 0,8 s, pour éviter le spam. */
const EMOTE_COOLDOWN_TICKS = Math.round(0.8 * TICK_RATE);
/** Noms donnés aux robots, dans l'ordre. */
const BOT_NAMES = ['Bip', 'Zorg', 'Nova', 'Tic', 'Rex', 'Pixel'];

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
  /** Présent dans le chat vocal du salon. */
  voice: boolean;
  /** Robot ajouté par l'hôte (son niveau), ou `null` pour un joueur humain. */
  bot: BotLevel | null;
  /** Horloge du salon au dernier émoji envoyé. */
  lastEmoteAt: number | null;
  /** Horloge du salon au moment de la coupure. */
  disconnectedAt: number | null;
  send(message: ServerMessage): void;
}

export function createPeer(id: string, token: string, name: string, send: (message: ServerMessage) => void): Peer {
  return { id, token, name, connected: true, ready: false, skin: 0, voice: false, bot: null, lastEmoteAt: null, disconnectedAt: null, send };
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
  /** Cerveaux des robots de la partie en cours, par numéro de joueur. */
  private brains = new Map<number, BotBrain>();
  private botCount = 0;
  private clock = 0;
  private matchTicks = 0;
  private readonly randomSeed: () => number;
  private readonly stats: RoomStats | null;
  /** Serveurs STUN/TURN transmis aux téléphones pour le chat vocal. */
  private readonly iceServers: IceServer[];

  constructor(
    code: string,
    randomSeed: () => number = () => Math.floor(Math.random() * 2 ** 31),
    stats: RoomStats | null = null,
    iceServers: IceServer[] = [],
  ) {
    this.code = code;
    this.randomSeed = randomSeed;
    this.stats = stats;
    this.iceServers = iceServers;
  }

  private welcome(peer: Peer): ServerMessage {
    return { type: 'welcome', room: this.code, you: peer.id, token: peer.token, iceServers: this.iceServers };
  }

  /** Plus aucun joueur humain : le salon peut disparaître (ses robots avec lui). */
  get isEmpty(): boolean {
    return !this.peers.some((peer) => !peer.bot);
  }

  private get inMatch(): boolean {
    return this.match !== null && this.match.phase !== 'matchOver';
  }

  join(peer: Peer): string | null {
    if (this.inMatch) return 'La partie a déjà commencé dans ce salon.';
    if (this.peers.length >= MAX_PLAYERS) return `Ce salon est complet (${MAX_PLAYERS} joueurs maximum).`;
    this.peers.push(peer);
    this.hostId ??= peer.id;
    peer.send(this.welcome(peer));
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
    peer.send(this.welcome(peer));
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
    // Le téléphone rejoindra de lui-même le vocal à son retour.
    peer.voice = false;
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

  /** Ajoute un robot, à la demande de l'hôte, pour compléter la partie. */
  addBot(peerId: string, level: BotLevel): string | null {
    if (peerId !== this.hostId) return 'Seul l’hôte peut ajouter un robot.';
    if (this.inMatch) return 'La partie a déjà commencé.';
    if (this.peers.length >= MAX_PLAYERS) return `Ce salon est complet (${MAX_PLAYERS} joueurs maximum).`;
    const taken = new Set(this.peers.map((peer) => peer.name));
    const name = BOT_NAMES.find((candidate) => !taken.has(candidate)) ?? 'Robot';
    const bot = createPeer(`robot-${++this.botCount}`, '', name, () => {});
    bot.bot = level;
    bot.ready = true;
    this.peers.push(bot);
    this.broadcastLobby();
    return null;
  }

  removeBot(peerId: string, botId: string): void {
    const bot = this.peers.find((peer) => peer.id === botId && peer.bot);
    if (peerId !== this.hostId || this.inMatch || !bot) return;
    this.peers = this.peers.filter((peer) => peer !== bot);
    this.broadcastLobby();
  }

  /** Entre dans le chat vocal du salon, ou en sort (possible aussi en pleine partie). */
  setVoice(peerId: string, on: boolean): void {
    const peer = this.peers.find((candidate) => candidate.id === peerId);
    if (!peer || peer.voice === on) return;
    peer.voice = on;
    this.broadcastLobby();
  }

  /** Relaie la mise en relation vocale entre deux joueurs présents dans le vocal. */
  relaySignal(fromId: string, toId: string, data: VoiceSignal): void {
    const from = this.peers.find((candidate) => candidate.id === fromId);
    const to = this.peers.find((candidate) => candidate.id === toId);
    if (!from?.voice || !to?.voice || !to.connected || from === to) return;
    to.send({ type: 'signal', from: fromId, data });
  }

  /** Émoji rapide d'un joueur de la partie, relayé à tous (lui compris). */
  sendEmote(peerId: string, emote: number): void {
    const peer = this.peers.find((candidate) => candidate.id === peerId);
    const seat = this.seats.get(peerId);
    if (!peer || seat === undefined || !this.match || !Number.isInteger(emote) || emote < 0 || emote >= EMOTES.length) return;
    if (peer.lastEmoteAt !== null && this.clock - peer.lastEmoteAt < EMOTE_COOLDOWN_TICKS) return;
    peer.lastEmoteAt = this.clock;
    this.broadcast({ type: 'emote', seat, emote });
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
    // Chacun redit s'il est partant pour la suivante ; les robots le sont toujours.
    for (const peer of this.peers) peer.ready = peer.bot !== null;
    const seed = this.randomSeed();
    this.match = createMatch(this.peers.length, seed, this.arena);
    const botRandom = createRng(seed ^ 0x5bd1e995);
    this.brains = new Map(
      this.peers.flatMap((peer, seat) => (peer.bot ? [[seat, new BotBrain(peer.bot, botRandom)] as const] : [])),
    );
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

    // Les robots décident comme des joueurs, à partir de l'état complet de la manche.
    if (match.phase === 'playing') {
      for (const [seat, brain] of this.brains) {
        const input = brain.decide(match.round, seat);
        this.directions[seat] = input.direction;
        if (input.bomb) this.pendingBombs[seat] = true;
      }
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
    // Sans joueur humain, les robots n'ont plus personne avec qui jouer.
    if (this.isEmpty) this.peers = [];
    if (this.hostId === peer.id) {
      const humans = this.peers.filter((candidate) => !candidate.bot);
      this.hostId = (humans.find((candidate) => candidate.connected) ?? humans[0])?.id ?? null;
    }
  }

  private broadcastLobby(): void {
    this.broadcast({
      type: 'lobby',
      host: this.hostId ?? '',
      players: this.peers.map(({ id, name, connected, ready, skin, voice, bot }) => ({
        id,
        name,
        connected,
        ready,
        skin,
        voice,
        ...(bot ? { bot } : {}),
      })),
      seats: Object.fromEntries(this.seats),
      inMatch: this.inMatch,
      arena: this.arena,
    });
  }

  private broadcast(message: ServerMessage): void {
    for (const peer of this.peers) if (peer.connected) peer.send(message);
  }
}
