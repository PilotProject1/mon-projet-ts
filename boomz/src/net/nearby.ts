import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { ClientMessage, ServerMessage } from './protocol';
import { Room } from './room';
import { newRoomCode, Session, type RoomDirectory } from './session';
import { TICK_SECONDS } from '../game/constants';

/**
 * Module natif des parties sans internet (ios/App/App/NearbyPlugin.swift :
 * Multipeer Connectivity, Bluetooth et Wi-Fi direct). Il ne fait que
 * transporter des messages texte entre téléphones proches.
 */
export interface NearbyPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  /** Annonce le salon aux téléphones proches et accepte leurs demandes. */
  startHosting(options: { room: string; name: string }): Promise<void>;
  /** Cherche les salons proches (événements `hostFound` et `hostLost`). */
  startBrowsing(): Promise<void>;
  /** Demande à rejoindre un salon trouvé. */
  join(options: { id: string }): Promise<void>;
  send(options: { to: string; data: string }): Promise<void>;
  /** Arrête tout : annonce, recherche et connexions. */
  stop(): Promise<void>;
  addListener(event: 'hostFound', listener: (host: NearbyHost) => void): Promise<PluginListenerHandle>;
  addListener(event: 'hostLost', listener: (event: { id: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'peerConnected' | 'peerDisconnected', listener: (event: { id: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'message', listener: (event: { from: string; data: string }) => void): Promise<PluginListenerHandle>;
}

export interface NearbyHost {
  id: string;
  room: string;
  /** Pseudo de l'hôte. */
  name: string;
}

export const Nearby = registerPlugin<NearbyPlugin>('Nearby', {
  web: () => import('./nearby-web').then((module) => new module.NearbyWeb()),
});

/** Mode sans internet proposé : sur iPhone, et dans le navigateur en développement (simulation). */
export async function nearbyAvailable(): Promise<boolean> {
  if (Capacitor.getPlatform() === 'web' && !import.meta.env.DEV) return false;
  if (Capacitor.getPlatform() === 'android') return false;
  try {
    return (await Nearby.isAvailable()).available;
  } catch {
    return false;
  }
}

/** Au-delà, un message d'un invité est ignoré (comme sur le serveur en ligne). */
const MAX_MESSAGE_BYTES = 1024;
/** Délai pour trouver et rejoindre le salon demandé. */
const JOIN_TIMEOUT_MS = 12_000;
/**
 * Silence de l'hôte au-delà duquel le contact est jugé perdu (il répond au
 * moins aux mesures de latence, envoyées toutes les 3 s).
 */
const SILENCE_TIMEOUT_MS = 8_000;

/**
 * Chaque nouvelle utilisation du module (salon créé, recherche) invalide un
 * arrêt différé demandé par la précédente.
 */
let generation = 0;
function begin(): number {
  return ++generation;
}
function stopLater(since: number, delayMs: number): void {
  window.setTimeout(() => {
    if (generation === since) void Nearby.stop();
  }, delayMs);
}

export interface Link {
  send(message: ClientMessage): void;
  close(): void;
}

/**
 * Le même état est envoyé à tous : on ne le convertit en texte qu'une fois.
 * Le texte est aussi une copie, indispensable pour le joueur de l'hôte : l'état
 * du salon continue d'évoluer après l'envoi.
 */
const serialized = new WeakMap<ServerMessage, string>();
function serialize(message: ServerMessage): string {
  let text = serialized.get(message);
  if (text === undefined) {
    text = JSON.stringify(message);
    serialized.set(message, text);
  }
  return text;
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Téléphone hôte d'une partie sans internet : il fait tourner le salon (le
 * même code que le serveur en ligne), y joue lui-même, et relaie l'état aux
 * téléphones proches. `advertise` à faux : partie seul contre des robots
 * (tutoriel), sans Bluetooth ni réseau.
 */
export class NearbyHostLink implements Link {
  private readonly room = new Room(newRoomCode());
  private readonly self: Session;
  private readonly guests = new Map<string, Session>();
  private readonly listeners: Array<Promise<PluginListenerHandle>> = [];
  private readonly timer: number;
  private readonly generation: number;
  private readonly advertise: boolean;
  private closed = false;

  constructor(name: string, onMessage: (message: ServerMessage) => void, advertise = true) {
    this.advertise = advertise;
    this.generation = advertise ? begin() : generation;
    const directory: RoomDirectory = {
      create: () => this.room,
      find: (code) => (code === this.room.code ? this.room : undefined),
    };
    this.self = new Session(directory, (message) => {
      const text = serialize(message);
      queueMicrotask(() => {
        if (!this.closed) onMessage(JSON.parse(text));
      });
    }, newId);

    if (advertise) this.listen(directory, name);

    // Simulation à pas fixe, comme sur le serveur.
    const tickMs = TICK_SECONDS * 1000;
    let last = performance.now();
    let accumulator = 0;
    this.timer = window.setInterval(() => {
      const now = performance.now();
      accumulator += Math.min(now - last, 250);
      last = now;
      while (accumulator >= tickMs) {
        this.room.tick();
        accumulator -= tickMs;
      }
    }, 4);
  }

  private listen(directory: RoomDirectory, name: string): void {
    this.listeners.push(
      Nearby.addListener('peerConnected', ({ id }) => {
        // Un téléphone revenu repart d'une connexion neuve (il reprendra sa place avec son jeton).
        this.guests.get(id)?.closed();
        this.guests.set(id, new Session(directory, (message) => void Nearby.send({ to: id, data: serialize(message) }), newId));
      }),
      Nearby.addListener('peerDisconnected', ({ id }) => {
        this.guests.get(id)?.closed();
        this.guests.delete(id);
      }),
      Nearby.addListener('message', ({ from, data }) => {
        if (data.length > MAX_MESSAGE_BYTES) return;
        try {
          this.guests.get(from)?.handle(JSON.parse(data));
        } catch {
          // Message illisible : ignoré.
        }
      }),
    );
    void Nearby.startHosting({ room: this.room.code, name });
  }

  send(message: ClientMessage): void {
    queueMicrotask(() => {
      if (!this.closed) this.self.handle(message);
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.timer);
    if (!this.advertise) return;
    for (const listener of this.listeners) void listener.then((handle) => handle.remove());
    // Les invités sont prévenus tout de suite, au lieu d'attendre en vain le retour de l'hôte.
    const farewell = serialize({ type: 'error', code: 'closed', message: 'L’hôte a fermé le salon.' });
    for (const id of this.guests.keys()) void Nearby.send({ to: id, data: farewell });
    stopLater(this.generation, 400);
  }
}

/** Téléphone invité : trouve le salon proche par son code, le rejoint, puis échange avec l'hôte. */
export class NearbyGuestLink implements Link {
  private hostId: string | null = null;
  private connected = false;
  private closed = false;
  private readonly queue: ClientMessage[] = [];
  private readonly listeners: Array<Promise<PluginListenerHandle>> = [];
  private readonly timeout: number;
  private readonly watchdog: number;
  private lastHeard = 0;
  private readonly onClose: () => void;
  private readonly generation = begin();

  constructor(room: string, onMessage: (message: ServerMessage) => void, onClose: () => void) {
    this.onClose = onClose;
    this.listeners.push(
      Nearby.addListener('hostFound', (host) => {
        if (this.hostId || host.room !== room) return;
        this.hostId = host.id;
        void Nearby.join({ id: host.id }).catch(() => this.fail());
      }),
      Nearby.addListener('peerConnected', ({ id }) => {
        if (id !== this.hostId || this.connected) return;
        this.connected = true;
        this.lastHeard = performance.now();
        window.clearTimeout(this.timeout);
        for (const message of this.queue.splice(0)) this.send(message);
      }),
      Nearby.addListener('peerDisconnected', ({ id }) => {
        if (id === this.hostId) this.fail();
      }),
      Nearby.addListener('message', ({ from, data }) => {
        if (from !== this.hostId || this.closed) return;
        this.lastHeard = performance.now();
        try {
          onMessage(JSON.parse(data));
        } catch {
          // Message illisible : ignoré.
        }
      }),
    );
    void Nearby.startBrowsing();
    this.timeout = window.setTimeout(() => this.fail(), JOIN_TIMEOUT_MS);
    this.watchdog = window.setInterval(() => {
      if (this.connected && performance.now() - this.lastHeard > SILENCE_TIMEOUT_MS) this.fail();
    }, 1000);
  }

  send(message: ClientMessage): void {
    if (this.closed) return;
    if (!this.connected || !this.hostId) {
      this.queue.push(message);
      return;
    }
    void Nearby.send({ to: this.hostId, data: JSON.stringify(message) });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.timeout);
    window.clearInterval(this.watchdog);
    for (const listener of this.listeners) void listener.then((handle) => handle.remove());
    // Laisse partir un dernier message (départ du salon) avant de couper.
    stopLater(this.generation, 400);
  }

  private fail(): void {
    if (this.closed) return;
    this.close();
    this.onClose();
  }
}

/** Liste des salons proches, pour l'écran d'accueil. */
export class NearbyScanner {
  private readonly hosts = new Map<string, NearbyHost>();
  private readonly listeners: Array<Promise<PluginListenerHandle>> = [];
  private readonly generation = begin();
  private stopped = false;

  constructor(onChange: (hosts: NearbyHost[]) => void) {
    const changed = () => onChange([...this.hosts.values()]);
    this.listeners.push(
      Nearby.addListener('hostFound', (host) => {
        this.hosts.set(host.id, host);
        changed();
      }),
      Nearby.addListener('hostLost', ({ id }) => {
        if (this.hosts.delete(id)) changed();
      }),
    );
    void Nearby.startBrowsing();
  }

  /** Arrête la recherche. `keepRadio` : la connexion qui suit relance elle-même le module. */
  stop(keepRadio = false): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const listener of this.listeners) void listener.then((handle) => handle.remove());
    if (!keepRadio) stopLater(this.generation, 0);
  }
}
