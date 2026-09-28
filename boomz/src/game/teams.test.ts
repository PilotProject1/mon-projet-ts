import { describe, expect, it } from 'vitest';
import { BotBrain } from './bot';
import { BOMB_FUSE_TICKS, TICK_RATE, WINS_TO_TAKE_MATCH } from './constants';
import { createRng } from './rng';
import { createMatch, stepMatch, wonBy } from './match';
import { Hero, POWER_START_TICKS } from './powers';
import { createRound, eliminatePlayer, stepRound } from './round';
import { NO_INPUT, Tile, type PlayerInput, type RoundState } from './types';

const BOMB: PlayerInput = { direction: null, bomb: true };
const POWER: PlayerInput = { direction: null, bomb: false, power: true };

/** Arène vide ; `teams` : équipe de chaque joueur. */
function arena(teams: number[] | null, characters: number[] = []): RoundState {
  const state = createRound(teams?.length ?? characters.length, 1, 'chantier', characters, true, teams);
  state.tiles = state.tiles.map((tile) => (tile === Tile.Wall ? Tile.Wall : Tile.Floor));
  state.tick = POWER_START_TICKS;
  return state;
}

function put(state: RoundState, id: number, x: number, y: number): void {
  state.players[id].x = x + 0.5;
  state.players[id].y = y + 0.5;
}

function step(state: RoundState, inputs: PlayerInput[], ticks = 1): void {
  for (let i = 0; i < ticks; i++) stepRound(state, inputs);
}

describe('parties en équipes', () => {
  it('les flammes d’un coéquipier épargnent, celles d’un adversaire non', () => {
    const state = arena([0, 0, 1]);
    put(state, 0, 1, 1);
    put(state, 1, 3, 1);
    put(state, 2, 1, 3);
    // Le joueur 0 pose et s'enfuit en bas à droite ; ses flammes couvrent 1 (coéquipier) et 2 (adversaire).
    step(state, [BOMB]);
    state.players[0].x = 9.5;
    state.players[0].y = 9.5;
    step(state, [NO_INPUT], BOMB_FUSE_TICKS);
    expect(state.players[1].alive).toBe(true);
    expect(state.players[2].alive).toBe(false);
  });

  it('sa propre bombe reste dangereuse, et chacun pour soi rien ne change', () => {
    const own = arena([0, 1]);
    put(own, 0, 1, 1);
    put(own, 1, 9, 9);
    step(own, [BOMB]);
    step(own, [NO_INPUT], BOMB_FUSE_TICKS);
    expect(own.players[0].alive).toBe(false);

    const ffa = arena(null, [0, 0, 0]);
    put(ffa, 0, 1, 1);
    put(ffa, 1, 3, 1);
    put(ffa, 2, 9, 9);
    step(ffa, [BOMB]);
    ffa.players[0].x = 9.5;
    ffa.players[0].y = 7.5;
    step(ffa, [NO_INPUT], BOMB_FUSE_TICKS);
    expect(ffa.players[1].alive).toBe(false);
  });

  it('le gel ne vise que les adversaires', () => {
    const state = arena([0, 0, 1], [Hero.Frost, Hero.Boomer, Hero.Boomer]);
    put(state, 0, 5, 5);
    put(state, 1, 6, 5);
    put(state, 2, 5, 6);
    step(state, [POWER]);
    expect(state.players[1].frozenUntil).toBe(0);
    expect(state.players[2].frozenUntil).toBeGreaterThan(state.tick);
  });

  it('la manche revient à la dernière équipe debout, pour tous ses membres', () => {
    const match = createMatch(4, 2, 'chantier', [], false, [0, 1, 0, 1]);
    match.phase = 'playing';
    eliminatePlayer(match.round, 0);
    eliminatePlayer(match.round, 3);
    stepMatch(match, []);
    expect(match.phase).toBe('playing');
    eliminatePlayer(match.round, 1);
    stepMatch(match, []);
    expect(match.phase).toBe('roundOver');
    expect(match.winningTeam).toBe(0);
    expect(match.scores).toEqual([1, 0, 1, 0]);
    expect(wonBy(match, 0)).toBe(true);
    expect(wonBy(match, 3)).toBe(false);
  });

  it('le match revient à l’équipe qui gagne assez de manches', () => {
    const match = createMatch(2, 3, 'chantier', [], false, [0, 1]);
    match.scores = [WINS_TO_TAKE_MATCH - 1, 0];
    match.phase = 'playing';
    eliminatePlayer(match.round, 1);
    stepMatch(match, []);
    expect(match.phase).toBe('matchOver');
    expect(match.matchWinner).toBe(0);
    expect(match.winningTeam).toBe(0);
  });

  it('un match entre robots en équipes va jusqu’au bout', { timeout: 60_000 }, () => {
    const match = createMatch(4, 7, 'rotation', [0, 2, 6, 7], true, [0, 1, 0, 1]);
    const rng = createRng(7);
    const brains = [0, 1, 2, 3].map(() => new BotBrain('expert', rng));
    for (let tick = 0; tick < 20 * 60 * TICK_RATE && match.phase !== 'matchOver'; tick++) {
      stepMatch(match, brains.map((brain, seat) => brain.decide(match.round, seat)));
    }
    expect(match.phase).toBe('matchOver');
    const team = match.winningTeam!;
    expect(match.teams!.map((t, seat) => (t === team ? match.scores[seat] : -1)).filter((s) => s >= 0)).toEqual([WINS_TO_TAKE_MATCH, WINS_TO_TAKE_MATCH]);
  });
});
