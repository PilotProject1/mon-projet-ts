import type { BotLevel } from './bot';
import { TICK_RATE } from './constants';
import type { MatchState } from './match';
import { Hero } from './powers';
import type { ArenaId } from './types';

export interface ChallengeBot {
  level: BotLevel;
  character: number;
}

/** Un défi solo : un match contre des robots imposés, sur une arène imposée. */
export interface Challenge {
  title: string;
  arena: ArenaId;
  bots: ChallengeBot[];
  /** Temps de jeu (secondes) sous lequel gagner rapporte l'étoile de vitesse. */
  parSeconds: number;
}

/** Étoiles, indépendantes les unes des autres (toutes demandent de gagner le match). */
export const STAR_WIN = 1;
/** Gagner sans qu'un adversaire ne remporte une seule manche. */
export const STAR_FLAWLESS = 2;
/** Gagner en moins de `parSeconds` de jeu. */
export const STAR_FAST = 4;
export const ALL_STARS = STAR_WIN | STAR_FLAWLESS | STAR_FAST;

const bot = (level: BotLevel, character: number): ChallengeBot => ({ level, character });

/** Les défis, dans l'ordre : chacun se débloque en gagnant le précédent. */
export const CHALLENGES: readonly Challenge[] = [
  { title: 'Premiers pas', arena: 'chantier', bots: [bot('debutant', Hero.Boomer)], parSeconds: 100 },
  { title: 'Téléportation', arena: 'laboratoire', bots: [bot('debutant', Hero.Rocket)], parSeconds: 100 },
  { title: 'Dalles fragiles', arena: 'temple', bots: [bot('debutant', Hero.Frost), bot('debutant', Hero.Toxic)], parSeconds: 130 },
  { title: 'Tapis roulants', arena: 'station', bots: [bot('pro', Hero.Boomette)], parSeconds: 110 },
  { title: 'Duel de pros', arena: 'chantier', bots: [bot('pro', Hero.Blaster)], parSeconds: 110 },
  { title: 'Coup de froid', arena: 'laboratoire', bots: [bot('pro', Hero.Frost), bot('pro', Hero.Frost)], parSeconds: 140 },
  { title: 'Air toxique', arena: 'temple', bots: [bot('pro', Hero.Toxic), bot('pro', Hero.Omega)], parSeconds: 140 },
  { title: 'Un contre trois', arena: 'station', bots: [bot('debutant', Hero.Rocket), bot('pro', Hero.Rocco), bot('pro', Hero.Blaster)], parSeconds: 170 },
  { title: 'L’expert', arena: 'chantier', bots: [bot('expert', Hero.Boomer)], parSeconds: 120 },
  { title: 'Carapaces', arena: 'temple', bots: [bot('expert', Hero.Rocco), bot('pro', Hero.Rocco)], parSeconds: 150 },
  { title: 'Chasse gardée', arena: 'laboratoire', bots: [bot('expert', Hero.Rocket), bot('expert', Hero.Omega)], parSeconds: 160 },
  {
    title: 'Le grand final',
    arena: 'station',
    bots: [bot('expert', Hero.Blaster), bot('expert', Hero.Frost), bot('expert', Hero.Toxic), bot('pro', Hero.Boomette), bot('pro', Hero.Rocket)],
    parSeconds: 220,
  },
];

/** Étoiles gagnées par le joueur `me` dans un match terminé (masque de `STAR_*`). */
export function starsEarned(match: MatchState, me: number, challenge: Challenge): number {
  if (match.phase !== 'matchOver' || match.matchWinner !== me) return 0;
  let stars = STAR_WIN;
  if (match.scores.every((score, seat) => seat === me || score === 0)) stars |= STAR_FLAWLESS;
  if (match.playTicks <= challenge.parSeconds * TICK_RATE) stars |= STAR_FAST;
  return stars;
}

export function starCount(mask: number): number {
  return (mask & STAR_WIN ? 1 : 0) + (mask & STAR_FLAWLESS ? 1 : 0) + (mask & STAR_FAST ? 1 : 0);
}

/** Étoiles obtenues, défi par défi (dans l'ordre de `CHALLENGES`). */
export type ChallengeProgress = number[];

/** Relit la progression enregistrée ; toute valeur illisible compte pour zéro étoile. */
export function parseProgress(raw: string | null): ChallengeProgress {
  let saved: unknown = [];
  try {
    saved = JSON.parse(raw ?? '[]');
  } catch {
    saved = [];
  }
  const list = Array.isArray(saved) ? saved : [];
  return CHALLENGES.map((_, i) => {
    const mask = list[i];
    return Number.isInteger(mask) ? (mask as number) & ALL_STARS : 0;
  });
}

/** Ajoute les étoiles d'une partie : une étoile gagnée reste acquise. */
export function recordStars(progress: ChallengeProgress, index: number, mask: number): ChallengeProgress {
  return progress.map((stars, i) => (i === index ? stars | mask : stars));
}

/** Le premier défi est ouvert ; les suivants s'ouvrent quand le précédent est gagné. */
export function isUnlocked(progress: ChallengeProgress, index: number): boolean {
  return index === 0 || (progress[index - 1] & STAR_WIN) !== 0;
}

export function totalStars(progress: ChallengeProgress): number {
  return progress.reduce((sum, mask) => sum + starCount(mask), 0);
}
