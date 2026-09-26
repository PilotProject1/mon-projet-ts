import { COUNTDOWN_TICKS, ROUND_OVER_TICKS, WINS_TO_TAKE_MATCH } from './constants';
import { alivePlayers, createRound, stepRound } from './round';
import type { PlayerInput, RoundEvent, RoundState } from './types';

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
  round: RoundState;
}

export function createMatch(playerCount: number, seed: number): MatchState {
  return {
    playerCount,
    seed,
    phase: 'countdown',
    phaseTick: 0,
    roundNumber: 1,
    scores: new Array<number>(playerCount).fill(0),
    roundWinner: null,
    matchWinner: null,
    round: createRound(playerCount, seed),
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
        match.round = createRound(match.playerCount, match.seed + match.roundNumber);
        setPhase(match, 'countdown');
      }
      return [];
    case 'matchOver':
      return [];
  }
}
