import { COUNTDOWN_TICKS, ROUND_OVER_TICKS, WINS_TO_TAKE_MATCH } from './constants';
import { alivePlayers, createRound, stepRound } from './round';
import { defaultCharacter } from './powers';
import { createRng } from './rng';
import { ARENA_IDS, type ArenaId, type PlayerInput, type RoundEvent, type RoundState } from './types';

/** Une arène imposée pour tout le match, ou une arène différente à chaque manche. */
export type ArenaChoice = ArenaId | 'rotation';

export type MatchPhase = 'countdown' | 'playing' | 'roundOver' | 'matchOver';

export interface MatchState {
  playerCount: number;
  seed: number;
  phase: MatchPhase;
  /** Ticks écoulés depuis le début de la phase courante. */
  phaseTick: number;
  roundNumber: number;
  scores: number[];
  /** Vainqueur de la dernière manche, `null` en cas d'égalité. */
  roundWinner: number | null;
  matchWinner: number | null;
  /** Arène de chaque manche, dans l'ordre (répétée si le match dure plus longtemps). */
  arenas: ArenaId[];
  /** Apparence choisie par chaque joueur (cosmétique, sans effet sur le jeu). */
  skins: number[];
  /** Personnage de chaque joueur (voir `CHARACTERS`). */
  characters: number[];
  /** Pouvoirs des personnages actifs (tous les téléphones de la partie les connaissent). */
  powers: boolean;
  /** Temps de jeu cumulé du match, hors comptes à rebours et pauses entre manches (ticks). */
  playTicks: number;
  round: RoundState;
}

function arenaPlan(choice: ArenaChoice, seed: number): ArenaId[] {
  if (choice !== 'rotation') return [choice];
  // Ordre mélangé, mais fixé par la graine.
  const rng = createRng(seed ^ 0x5bd1e995);
  const order = [...ARENA_IDS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function arenaForRound(match: Pick<MatchState, 'arenas'>, roundNumber: number): ArenaId {
  return match.arenas[(roundNumber - 1) % match.arenas.length];
}

export function createMatch(
  playerCount: number,
  seed: number,
  arenaChoice: ArenaChoice = 'chantier',
  characters: readonly number[] = [],
  powers = false,
): MatchState {
  const arenas = arenaPlan(arenaChoice, seed);
  const cast = Array.from({ length: playerCount }, (_, seat) => characters[seat] ?? defaultCharacter(seat));
  return {
    playerCount,
    seed,
    phase: 'countdown',
    phaseTick: 0,
    roundNumber: 1,
    scores: new Array<number>(playerCount).fill(0),
    roundWinner: null,
    matchWinner: null,
    arenas,
    skins: new Array<number>(playerCount).fill(0),
    characters: cast,
    powers,
    playTicks: 0,
    round: createRound(playerCount, seed, arenas[0], cast, powers),
  };
}

function setPhase(match: MatchState, phase: MatchPhase): void {
  match.phase = phase;
  match.phaseTick = 0;
}

export function stepMatch(match: MatchState, inputs: ReadonlyArray<PlayerInput>): RoundEvent[] {
  match.phaseTick++;
  switch (match.phase) {
    case 'countdown':
      if (match.phaseTick >= COUNTDOWN_TICKS) setPhase(match, 'playing');
      return [];
    case 'playing': {
      match.playTicks++;
      const events = stepRound(match.round, inputs);
      const alive = alivePlayers(match.round);
      if (alive.length <= 1) {
        match.roundWinner = alive.length === 1 ? alive[0].id : null;
        if (match.roundWinner !== null) match.scores[match.roundWinner]++;
        if (match.roundWinner !== null && match.scores[match.roundWinner] >= WINS_TO_TAKE_MATCH) {
          match.matchWinner = match.roundWinner;
          setPhase(match, 'matchOver');
        } else {
          setPhase(match, 'roundOver');
        }
      }
      return events;
    }
    case 'roundOver':
      if (match.phaseTick >= ROUND_OVER_TICKS) {
        match.roundNumber++;
        match.round = createRound(
          match.playerCount,
          match.seed + match.roundNumber,
          arenaForRound(match, match.roundNumber),
          match.characters,
          match.powers,
        );
        setPhase(match, 'countdown');
      }
      return [];
    case 'matchOver':
      return [];
  }
}
