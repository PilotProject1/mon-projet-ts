import type { ArenaChoice, MatchState } from '../game/match';
import type { Direction } from '../game/types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
/** Le serveur envoie l'état tous les N ticks (60 / 3 = 20 envois par seconde). */
export const SNAPSHOT_EVERY_TICKS = 3;
/** Délai laissé à un téléphone qui a perdu la connexion pour revenir. */
export const RECONNECT_GRACE_SECONDS = 8;
export const WS_PATH = '/ws';

export interface LobbyPlayer {
  /** Identifiant public du joueur, stable pendant la vie du salon. */
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  /** Apparence choisie (cosmétique). */
  skin: number;
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
  | { type: 'ping'; sent: number };

export type ServerMessage =
  | { type: 'welcome'; room: string; you: string; token: string }
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
  /** `closed` : l'hôte d'une partie sans internet a fermé son salon. */
  | { type: 'error'; message: string; code?: 'resume-failed' | 'closed' };
