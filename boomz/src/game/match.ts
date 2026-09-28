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
  /**
   * Équipe de chaque joueur (0 ou 1) en partie par équipes, `null` sinon. Une
   * manche gagnée compte pour tous les membres de l'équipe, éliminés compris.
   */
  teams: number[] | null;
  /** Équipe gagnante de la dernière manche (puis du match), `null` : égalité ou chacun pour soi. */
  winningTeam: number | null;
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

/** Ce joueur a-t-il gagné la dernière manche (ou le match), seul ou avec son équipe ? */
export function wonBy(match: MatchState, seat: number | null, winner: number | null = match.roundWinner): boolean {
  if (seat === null || winner === null) return false;
  return match.teams ? match.teams[seat] === match.teams[winner] : seat === winner;
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
  teams: readonly number[] | null = null,
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
    teams: teams ? teams.slice(0, playerCount) : null,
    winningTeam: null,
    round: createRound(playerCount, seed, arenas[0], cast, powers, teams),
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
      const teams = match.teams;
      // En équipes, la manche s'arrête quand il ne reste qu'une équipe debout.
      const standing = teams ? new Set(alive.map((player) => teams[player.id])) : null;
      if (standing ? standing.size <= 1 : alive.length <= 1) {
        match.roundWinner = alive.length >= 1 ? alive[0].id : null;
        match.winningTeam = teams && match.roundWinner !== null ? teams[match.roundWinner] : null;
        if (match.roundWinner !== null) {
          for (let seat = 0; seat < match.playerCount; seat++) {
            if (seat === match.roundWinner || (teams && teams[seat] === match.winningTeam)) match.scores[seat]++;
          }
        }
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
          match.teams,
        );
        setPhase(match, 'countdown');
      }
      return [];
    case 'matchOver':
      return [];
  }
}
