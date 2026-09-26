import { BOT_LEVELS } from '../game/bot';
import { ARENA_IDS } from '../game/types';
import type { ClientMessage, ServerMessage, VoiceSignal } from './protocol';
import { createPeer, type Peer, type Room } from './room';

const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;

export function newRoomCode(taken: (code: string) => boolean = () => false): string {
  let code: string;
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join('');
  } while (taken(code));
  return code;
}

export function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 16) : '';
  return name || 'Joueur';
}

/** Taille maximale d'un message de mise en relation vocale (description de session comprise). */
const MAX_SIGNAL_CHARS = 12_000;

function isSignal(data: unknown): data is VoiceSignal {
  if (typeof data !== 'object' || data === null) return false;
  const { description, candidate } = data as VoiceSignal;
  const valid =
    (description !== undefined &&
      (description.type === 'offer' || description.type === 'answer') &&
      typeof description.sdp === 'string') ||
    (candidate !== undefined && typeof candidate.candidate === 'string');
  return valid && JSON.stringify(data).length <= MAX_SIGNAL_CHARS;
}

/** Salons connus de celui qui les héberge : tous ceux du serveur, ou l'unique salon du téléphone hôte. */
export interface RoomDirectory {
  create(): Room;
  find(code: string): Room | undefined;
}

/**
 * Une connexion d'un téléphone vue par celui qui héberge : traduit ses
 * messages en actions sur son salon. Le transport (WebSocket en ligne,
 * Bluetooth ou Wi-Fi direct sans internet) reste à l'extérieur.
 */
export class Session {
  private peer: Peer | null = null;
  private room: Room | null = null;
  private readonly directory: RoomDirectory;
  private readonly send: (message: ServerMessage) => void;
  private readonly newId: () => string;

  constructor(directory: RoomDirectory, send: (message: ServerMessage) => void, newId: () => string) {
    this.directory = directory;
    this.send = send;
    this.newId = newId;
  }

  handle(message: ClientMessage): void {
    const send = this.send;
    switch (message.type) {
      case 'create':
      case 'join': {
        if (this.room) return;
        const target = message.type === 'create' ? this.directory.create() : this.directory.find(String(message.room).trim().toUpperCase());
        if (!target) {
          send({ type: 'error', message: 'Salon introuvable : vérifiez le code ou demandez un nouveau lien.' });
          return;
        }
        const candidate = createPeer(this.newId(), this.newId(), cleanName(message.name), send);
        const error = target.join(candidate);
        if (error) {
          send({ type: 'error', message: error });
          return;
        }
        this.room = target;
        this.peer = candidate;
        return;
      }
      case 'resume': {
        if (this.room) return;
        const target = this.directory.find(String(message.room).toUpperCase());
        const resumed = target?.resume(String(message.token), send) ?? null;
        if (!target || !resumed) {
          send({ type: 'error', code: 'resume-failed', message: 'La place dans ce salon a expiré.' });
          return;
        }
        this.room = target;
        this.peer = resumed;
        return;
      }
      case 'ping':
        // Mesure de latence, pour les avis des testeurs.
        if (typeof message.sent === 'number') send({ type: 'pong', sent: message.sent });
        return;
      case 'leave':
        if (this.room && this.peer) this.room.leave(this.peer.id);
        this.room = null;
        this.peer = null;
        return;
    }
    const room = this.room;
    const peer = this.peer;
    if (!room || !peer) return;
    switch (message.type) {
      case 'ready':
        room.setReady(peer.id, message.ready === true);
        return;
      case 'skin':
        room.setSkin(peer.id, Number(message.skin));
        return;
      case 'arena':
        if (message.arena === 'rotation' || (ARENA_IDS as readonly string[]).includes(message.arena)) {
          room.setArena(peer.id, message.arena);
        }
        return;
      case 'start': {
        const error = room.start(peer.id);
        if (error) send({ type: 'error', message: error });
        return;
      }
      case 'input':
        if (message.direction === null || ['up', 'down', 'left', 'right'].includes(message.direction)) {
          room.setDirection(peer.id, message.direction);
        }
        return;
      case 'bomb':
        room.requestBomb(peer.id);
        return;
      case 'detonate':
        room.requestDetonation(peer.id);
        return;
      case 'addBot': {
        if (!BOT_LEVELS.includes(message.level)) return;
        const error = room.addBot(peer.id, message.level);
        if (error) send({ type: 'error', message: error });
        return;
      }
      case 'removeBot':
        room.removeBot(peer.id, String(message.id));
        return;
      case 'voice':
        room.setVoice(peer.id, message.on === true);
        return;
      case 'emote':
        room.sendEmote(peer.id, Number(message.emote));
        return;
      case 'signal':
        if (typeof message.to === 'string' && isSignal(message.data)) room.relaySignal(peer.id, message.to, message.data);
        return;
    }
  }

  /**
   * Connexion perdue. Le joueur garde sa place quelques secondes : un
   * téléphone qui change de réseau ou recharge la page peut la reprendre. Si
   * elle a déjà été reprise par une nouvelle connexion, rien à faire.
   */
  closed(): void {
    if (this.room && this.peer && this.peer.send === this.send) this.room.disconnect(this.peer.id);
  }
}
