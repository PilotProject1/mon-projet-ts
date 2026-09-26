import type { ArenaChoice, MatchState } from '../game/match';
import type { BotLevel } from '../game/bot';
import type { Direction } from '../game/types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
/** Le serveur envoie l'état tous les N ticks (60 / 3 = 20 envois par seconde). */
export const SNAPSHOT_EVERY_TICKS = 3;
/** Délai laissé à un téléphone qui a perdu la connexion pour revenir. */
export const RECONNECT_GRACE_SECONDS = 8;
export const WS_PATH = '/ws';
/** Émojis rapides envoyés pendant une partie (on transmet leur numéro). */
export const EMOTES = ['😂', '😡', '👋', '😎', '😱', '👍'] as const;

export interface LobbyPlayer {
  /** Identifiant public du joueur, stable pendant la vie du salon. */
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  /** Apparence choisie (cosmétique). */
  skin: number;
  /** Présent dans le chat vocal du salon. */
  voice: boolean;
  /** Robot ajouté par l'hôte, avec son niveau ; absent pour un joueur humain. */
  bot?: BotLevel;
}

/**
 * Message de mise en relation WebRTC entre deux téléphones (chat vocal) :
 * description de session ou candidat réseau. Le serveur le relaie sans le lire.
 */
export interface VoiceSignal {
  description?: { type: 'offer' | 'answer'; sdp: string };
  candidate?: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
}

/** Serveurs STUN/TURN proposés aux téléphones pour se joindre (chat vocal). */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type ClientMessage =
  | { type: 'create'; name: string }
  | { type: 'join'; room: string; name: string }
  /** Retour après une coupure, avec le jeton secret reçu à l'arrivée. */
  | { type: 'resume'; room: string; token: string }
  | { type: 'ready'; ready: boolean }
  /** Choix de son apparence (cosmétique). */
  | { type: 'skin'; skin: number }
  /** Choix de l'arène, réservé à l'hôte. */
  | { type: 'arena'; arena: ArenaChoice }
  | { type: 'start' }
  | { type: 'leave' }
  | { type: 'input'; direction: Direction | null }
  | { type: 'bomb' }
  /** Déclenche ses bombes (bonus Détonateur). */
  | { type: 'detonate' }
  /** Mesure de la latence : le serveur renvoie aussitôt `sent`. */
  | { type: 'ping'; sent: number }
  /** Ajoute un robot au salon (réservé à l'hôte). */
  | { type: 'addBot'; level: BotLevel }
  /** Retire un robot du salon (réservé à l'hôte). */
  | { type: 'removeBot'; id: string }
  /** Rejoint ou quitte le chat vocal du salon. */
  | { type: 'voice'; on: boolean }
  /** Mise en relation vocale avec un autre joueur du salon (relayée telle quelle). */
  | { type: 'signal'; to: string; data: VoiceSignal }
  /** Émoji rapide (numéro dans `EMOTES`), montré à tous au-dessus de son personnage. */
  | { type: 'emote'; emote: number };

export type ServerMessage =
  | { type: 'welcome'; room: string; you: string; token: string; iceServers?: IceServer[] }
  | {
      type: 'lobby';
      host: string;
      /** Dans l'ordre d'arrivée, qui fixe aussi le personnage de chacun. */
      players: LobbyPlayer[];
      /** Numéro de joueur dans la partie en cours, par identifiant. */
      seats: Record<string, number>;
      inMatch: boolean;
      arena: ArenaChoice;
    }
  | { type: 'snapshot'; match: MatchState }
  | { type: 'pong'; sent: number }
  | { type: 'signal'; from: string; data: VoiceSignal }
  | { type: 'emote'; seat: number; emote: number }
  /** `closed` : l'hôte d'une partie sans internet a fermé son salon. */
  | { type: 'error'; message: string; code?: 'resume-failed' | 'closed' };
