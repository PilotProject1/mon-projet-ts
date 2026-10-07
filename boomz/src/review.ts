import { Capacitor, registerPlugin } from '@capacitor/core';

/** Module natif de demande de note (ios/App/App/ReviewPlugin.swift). */
const Native = registerPlugin<{ request(): Promise<void> }>('BoomzReview');

/** Ce qu'on retient, sur ce téléphone, pour choisir le bon moment. */
export interface ReviewMemory {
  matches: number;
  wins: number;
  /** Dernière demande (ms depuis 1970), 0 : jamais. */
  askedAt: number;
}

const MIN_MATCHES = 3;
const MIN_WINS = 2;
/** Entre deux demandes (iOS en limite aussi le nombre : trois par an). */
const ASK_EVERY_MS = 30 * 24 * 3600 * 1000;

export function parseMemory(raw: string | null): ReviewMemory {
  try {
    const value = JSON.parse(raw ?? '') as Partial<ReviewMemory>;
    const count = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 ? (n as number) : 0);
    return { matches: count(value.matches), wins: count(value.wins), askedAt: Number(value.askedAt) || 0 };
  } catch {
    return { matches: 0, wins: 0, askedAt: 0 };
  }
}

/**
 * Fin d'un match : met à jour la mémoire et dit s'il faut demander une note.
 * Seulement juste après une victoire, pour un joueur qui a déjà joué et gagné
 * quelques matchs, et pas plus d'une fois par mois.
 */
export function afterMatch(memory: ReviewMemory, won: boolean, now: number): { memory: ReviewMemory; ask: boolean } {
  const next = { ...memory, matches: memory.matches + 1, wins: memory.wins + (won ? 1 : 0) };
  const ask = won && next.matches >= MIN_MATCHES && next.wins >= MIN_WINS && now - memory.askedAt >= ASK_EVERY_MS;
  if (ask) next.askedAt = now;
  return { memory: next, ask };
}

/** Ouvre la fenêtre de note d'Apple (sans effet hors de l'application iPhone). */
export function requestReview(): void {
  if (Capacitor.getPlatform() !== 'ios') return;
  void Native.request().catch(() => {});
}
