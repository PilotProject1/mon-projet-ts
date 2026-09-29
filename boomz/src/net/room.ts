import { SKIN_COUNT, TICK_RATE } from '../game/constants';
import { createMatch, stepMatch, type ArenaChoice, type MatchState } from '../game/match';
import { BotBrain, type BotLevel } from '../game/bot';
import { ACCESSORIES, isAccessory } from '../game/accessories';
import { CHARACTER_COUNT, defaultCharacter, isCharacter } from '../game/powers';
import { createRng } from '../game/rng';
import { eliminatePlayer } from '../game/round';
import type { Direction, PlayerInput, RoundEvent } from '../game/types';
import {
  EMOTES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RECONNECT_GRACE_SECONDS,
  SNAPSHOT_EVERY_TICKS,
  TEAM_COUNT,
  type GameMode,
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
/**
 * Un téléphone à jour annonce son personnage dès son arrivée : passé ce délai
 * sans l'avoir fait, c'est une version plus ancienne de l'application.
 */
const OUTDATED_AFTER_TICKS = 3 * TICK_RATE;
/** Affiché aux anciennes versions (dans la zone des messages du salon, qu'elles connaissent toutes). */
export const UPDATE_NOTICE =
  'Une nouvelle version de Boomz est disponible : mettez l’application à jour (TestFlight ou App Store) pour jouer avec les autres joueurs à armes égales, personnages et pouvoirs compris.';
/** Au plus un émoji par joueur toutes les 0,8 s, pour éviter le spam. */
const EMOTE_COOLDOWN_TICKS = Math.round(0.8 * TICK_RATE);
/** Noms donnés aux robots, dans l'ordre. */
const BOT_NAMES = ['Bip', 'Zorg', 'Nova', 'Tic', 'Rex', 'Pixel'];

/**
 * État envoyé aux téléphones. Les bonus cachés sous les caisses restent sur le
 * serveur (sinon un joueur pourrait les lire) ; l'ordre du resserrement ne sert
 * qu'au serveur.
 */
let snapshotSeq = 0;

function snapshotMessage(match: MatchState): ServerMessage {
  return {
    type: 'snapshot',
    seq: ++snapshotSeq,
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
  /** Personnage choisi, ou `null` : celui de sa place. */
  character: number | null;
  /**
   * Le téléphone connaît les pouvoirs (il a choisi un personnage). Les
   * pouvoirs ne sont actifs que si tous les joueurs humains les connaissent :
   * une version plus ancienne de l'application joue sans.
   */
  powersAware: boolean;
  /** Équipe (0 ou 1), utilisée en partie par équipes. */
  team: number;
  /** Accessoire porté (cosmétique). */
  accessory: number;
  /** Le téléphone connaît les parties en équipes (versions récentes). */
  teamsAware: boolean;
  /** Horloge du salon à l'arrivée (ou au retour) du téléphone. */
  joinedAt: number;
  /** Horloge du salon au dernier émoji envoyé. */
  lastEmoteAt: number | null;
  /** Horloge du salon au moment de la coupure. */
  disconnectedAt: number | null;
  send(message: ServerMessage): void;
}

export function createPeer(id: string, token: string, name: string, send: (message: ServerMessage) => void): Peer {
  return {
    id,
    token,
    name,
    connected: true,
    ready: false,
    skin: 0,
    voice: false,
    bot: null,
    character: null,
    powersAware: false,
    team: 0,
    accessory: 0,
    teamsAware: false,
    joinedAt: 0,
    lastEmoteAt: null,
    disconnectedAt: null,
    send,
  };
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
  private pendingPowers: boolean[] = [];
  private arena: ArenaChoice = 'rotation';
  private mode: GameMode = 'ffa';
  /** Cerveaux des robots de la partie en cours, par numéro de joueur. */
  private brains = new Map<number, BotBrain>();
  private botCount = 0;
  private clock = 0;
  private matchTicks = 0;
  private readonly randomSeed: () => number;
  private readonly stats: RoomStats | null;
  /** Serveurs STUN/TURN transmis aux téléphones pour le chat vocal. */
  private readonly iceServers: IceServer[];
  /** Anciennes versions déjà prévenues qu'une mise à jour existe. */
  private readonly warnedOutdated = new Set<string>();

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
    peer.team = this.smallerTeam();
    this.peers.push(peer);
    this.hostId ??= peer.id;
    peer.joinedAt = this.clock;
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
    peer.joinedAt = this.clock;
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

  setAccessory(peerId: string, accessory: number): void {
    const peer = this.peers.find((candidate) => candidate.id === peerId);
    if (!peer || this.inMatch || !isAccessory(accessory)) return;
    peer.accessory = accessory;
    this.broadcastLobby();
  }

  setCharacter(peerId: string, character: number): void {
    const peer = this.peers.find((candidate) => candidate.id === peerId);
    if (!peer || this.inMatch || !isCharacter(character)) return;
    peer.character = character;
    peer.powersAware = true;
    this.broadcastLobby();
  }

  /** Ajoute un robot, à la demande de l'hôte, pour compléter la partie (`character` : imposé, sinon au hasard). */
  addBot(peerId: string, level: BotLevel, character?: number): string | null {
    if (peerId !== this.hostId) return 'Seul l’hôte peut ajouter un robot.';
    if (this.inMatch) return 'La partie a déjà commencé.';
    if (this.peers.length >= MAX_PLAYERS) return `Ce salon est complet (${MAX_PLAYERS} joueurs maximum).`;
    const taken = new Set(this.peers.map((peer) => peer.name));
    const name = BOT_NAMES.find((candidate) => !taken.has(candidate)) ?? 'Robot';
    const bot = createPeer(`robot-${++this.botCount}`, '', name, () => {});
    bot.bot = level;
    bot.ready = true;
    // Un personnage que personne n'a encore pris, si possible.
    const cast = new Set(this.peers.map((peer, seat) => peer.character ?? defaultCharacter(seat)));
    const free = Array.from({ length: CHARACTER_COUNT }, (_, i) => i).filter((i) => !cast.has(i));
    const pool = free.length ? free : Array.from({ length: CHARACTER_COUNT }, (_, i) => i);
    bot.character = isCharacter(character) ? character : pool[Math.floor(Math.random() * pool.length)];
    bot.team = this.smallerTeam();
    // Un robot sur deux porte un accessoire, pour varier les silhouettes.
    bot.accessory = Math.random() < 0.5 ? 1 + Math.floor(Math.random() * (ACCESSORIES.length - 1)) : 0;
    bot.teamsAware = true;
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

  /** Équipe la moins nombreuse, pour y placer un nouvel arrivant. */
  private smallerTeam(): number {
    const counts = new Array<number>(TEAM_COUNT).fill(0);
    for (const peer of this.peers) counts[peer.team]++;
    return counts.indexOf(Math.min(...counts));
  }

  setMode(peerId: string, mode: GameMode): void {
    if (peerId !== this.hostId || this.inMatch) return;
    this.mode = mode;
    this.broadcastLobby();
  }

  /** Change d'équipe : soi-même, ou un robot si l'on est l'hôte. */
  setTeam(peerId: string, team: number, targetId?: string): void {
    if (this.inMatch || !Number.isInteger(team) || team < 0 || team >= TEAM_COUNT) return;
    const target = this.peers.find((peer) => peer.id === (targetId ?? peerId));
    if (!target || (target.id !== peerId && (peerId !== this.hostId || !target.bot))) return;
    target.team = team;
    this.broadcastLobby();
  }

  setFeatures(peerId: string, teams: boolean): void {
    const peer = this.peers.find((candidate) => candidate.id === peerId);
    if (peer) peer.teamsAware = teams;
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
    if (this.mode === 'teams') {
      const outdated = present.find((peer) => !peer.bot && !peer.teamsAware);
      if (outdated) return `${outdated.name} doit mettre à jour Boomz pour jouer en équipes.`;
      for (let team = 0; team < TEAM_COUNT; team++) {
        if (!present.some((peer) => peer.team === team)) return 'Il faut au moins un joueur dans chaque équipe.';
      }
    }
    this.seats = new Map(this.peers.map((peer, seat) => [peer.id, seat]));
    this.directions = this.peers.map(() => null);
    this.pendingBombs = this.peers.map(() => false);
    this.pendingDetonations = this.peers.map(() => false);
    this.pendingPowers = this.peers.map(() => false);
    // Chacun redit s'il est partant pour la suivante ; les robots le sont toujours.
    for (const peer of this.peers) peer.ready = peer.bot !== null;
    const seed = this.randomSeed();
    const characters = this.peers.map((peer, seat) => peer.character ?? defaultCharacter(seat));
    const powers = this.peers.every((peer) => peer.bot !== null || peer.powersAware);
    const teams = this.mode === 'teams' ? this.peers.map((peer) => peer.team) : null;
    this.match = createMatch(this.peers.length, seed, this.arena, characters, powers, teams);
    const botRandom = createRng(seed ^ 0x5bd1e995);
    this.brains = new Map(
      this.peers.flatMap((peer, seat) => (peer.bot ? [[seat, new BotBrain(peer.bot, botRandom)] as const] : [])),
    );
    this.match.skins = distinctSkins(characters, this.peers.map((peer) => peer.skin));
    this.match.accessories = this.peers.map((peer) => peer.accessory);
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

  requestPower(peerId: string): void {
    const seat = this.seats.get(peerId);
    if (seat !== undefined && this.inMatch) this.pendingPowers[seat] = true;
  }

  requestDetonation(peerId: string): void {
    const seat = this.seats.get(peerId);
    if (seat !== undefined && this.inMatch) this.pendingDetonations[seat] = true;
  }

  tick(): void {
    this.clock++;
    this.expireDisconnected();
    // Une ancienne version vient d'être repérée : la prévenir (avec la liste du salon).
    if (this.peers.some((peer) => this.isOutdated(peer) && !this.warnedOutdated.has(peer.id))) this.broadcastLobby();

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
        if (input.power) this.pendingPowers[seat] = true;
      }
    }

    const inputs: PlayerInput[] = this.directions.map((direction, seat) => ({
      direction,
      bomb: this.pendingBombs[seat],
      detonate: this.pendingDetonations[seat],
      power: this.pendingPowers[seat],
    }));
    // Une commande reçue pendant le compte à rebours est ignorée, pas mise en réserve.
    this.pendingBombs.fill(false);
    this.pendingDetonations.fill(false);
    this.pendingPowers.fill(false);
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

  /**
   * Téléphone avec une version plus ancienne que celle d'un autre joueur du
   * salon (il n'annonce pas de personnage) : il joue sans vocal ni pouvoirs.
   */
  private isOutdated(peer: Peer): boolean {
    if (peer.bot || peer.powersAware || !peer.connected || this.clock - peer.joinedAt < OUTDATED_AFTER_TICKS) return false;
    return this.peers.some((other) => !other.bot && other.powersAware);
  }

  private broadcastLobby(): void {
    this.broadcast({
      type: 'lobby',
      host: this.hostId ?? '',
      players: this.peers.map(({ id, name, connected, ready, skin, voice, bot, character, team, accessory }) => ({
        id,
        name,
        connected,
        ready,
        skin,
        voice,
        team,
        ...(accessory ? { accessory } : {}),
        ...(bot ? { bot } : {}),
        ...(character !== null ? { character } : {}),
      })),
      seats: Object.fromEntries(this.seats),
      inMatch: this.inMatch,
      arena: this.arena,
      mode: this.mode,
    });
    // Après la liste : une ancienne version efface ses messages en l'affichant.
    for (const peer of this.peers) {
      if (!this.isOutdated(peer)) continue;
      this.warnedOutdated.add(peer.id);
      peer.send({ type: 'error', message: UPDATE_NOTICE });
    }
  }

  private broadcast(message: ServerMessage): void {
    for (const peer of this.peers) if (peer.connected) peer.send(message);
  }
}

/**
 * Deux joueurs sur le même personnage ne doivent pas se ressembler : le second
 * prend une autre apparence de ce personnage, s'il en reste.
 */
export function distinctSkins(characters: readonly number[], wanted: readonly number[]): number[] {
  const used = new Set<string>();
  return characters.map((character, seat) => {
    let skin = wanted[seat] ?? 0;
    for (let tries = 0; tries < SKIN_COUNT && used.has(`${character}:${skin}`); tries++) skin = (skin + 1) % SKIN_COUNT;
    used.add(`${character}:${skin}`);
    return skin;
  });
}
