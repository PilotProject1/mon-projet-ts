import { describe, expect, it } from 'vitest';
import { BASE_RANGE, BOMB_FUSE_TICKS } from './constants';
import { createMatch, stepMatch } from './match';
import { DASH_CELLS, FREEZE_TICKS, Hero, POWER_START_TICKS, SURCHARGE_RANGE } from './powers';
import { bombAt, cellOf, createRound, stepRound } from './round';
import { NO_INPUT, Tile, type PlayerInput, type RoundState } from './types';

const POWER: PlayerInput = { direction: null, bomb: false, power: true };
const BOMB: PlayerInput = { direction: null, bomb: true };

/** Manche à deux, arène vide, pouvoirs actifs et déjà rechargés. */
function arena(characters: number[], powers = true): RoundState {
  const state = createRound(characters.length, 1, 'chantier', characters, powers);
  state.tiles = state.tiles.map((tile) => (tile === Tile.Wall ? Tile.Wall : Tile.Floor));
  state.tick = POWER_START_TICKS;
  return state;
}

/** Place le joueur au centre d'une case. */
function put(state: RoundState, id: number, x: number, y: number): void {
  state.players[id].x = x + 0.5;
  state.players[id].y = y + 0.5;
}

function step(state: RoundState, inputs: PlayerInput[], ticks = 1) {
  const events = [];
  for (let i = 0; i < ticks; i++) events.push(...stepRound(state, inputs));
  return events;
}

describe('pouvoirs', () => {
  it('ne marchent pas quand ils sont désactivés, ni avant la fin de la recharge', () => {
    const off = arena([Hero.Rocco, Hero.Boomer], false);
    step(off, [POWER]);
    expect(off.players[0].effect).toBe(-1);

    const on = arena([Hero.Rocco, Hero.Boomer]);
    on.tick = 0;
    step(on, [POWER]);
    expect(on.players[0].effect).toBe(-1);
  });

  it('Surcharge (Boomer) : bombes plus longues pendant quelques secondes, puis recharge', () => {
    const state = arena([Hero.Boomer, Hero.Blaster]);
    const events = step(state, [POWER]);
    expect(events).toContainEqual({ type: 'powerUsed', player: 0, power: Hero.Boomer });
    step(state, [BOMB]);
    expect(state.bombs[0].range).toBe(BASE_RANGE + SURCHARGE_RANGE);
    // Pouvoir en recharge : une nouvelle demande est sans effet.
    const again = step(state, [POWER]);
    expect(again.some((event) => event.type === 'powerUsed')).toBe(false);
  });

  it('Mise à feu (Blaster) : ses bombes explosent presque aussitôt, et rien sans bombe', () => {
    const state = arena([Hero.Blaster, Hero.Boomer]);
    expect(step(state, [POWER]).some((event) => event.type === 'powerUsed')).toBe(false);
    step(state, [BOMB]);
    const events = step(state, [POWER], 25);
    expect(events.some((event) => event.type === 'explosion')).toBe(true);
    expect(state.bombs).toHaveLength(0);
  });

  it('Gel (Frost) : un adversaire proche est figé, un lointain non', () => {
    const state = arena([Hero.Frost, Hero.Boomer, Hero.Rocco]);
    put(state, 0, 5, 5);
    put(state, 1, 6, 5);
    put(state, 2, 11, 9);
    step(state, [POWER]);
    expect(state.players[1].frozenUntil).toBeGreaterThan(state.tick);
    expect(state.players[2].frozenUntil).toBe(0);
    const x = state.players[1].x;
    step(state, [NO_INPUT, { direction: 'right', bomb: true }], 30);
    expect(state.players[1].x).toBe(x);
    expect(state.bombs).toHaveLength(0);
    step(state, [NO_INPUT, { direction: 'right', bomb: false }], FREEZE_TICKS);
    expect(state.players[1].x).toBeGreaterThan(x);
  });

  it('Zone toxique (Toxic) : le nuage tue les autres, pas Toxic', () => {
    const state = arena([Hero.Toxic, Hero.Boomer]);
    put(state, 0, 5, 1);
    put(state, 1, 9, 1);
    step(state, [POWER]);
    step(state, [BOMB]);
    // Toxic s'abrite dans le couloir voisin, puis revient dans le nuage.
    step(state, [{ direction: 'down', bomb: false }], 60);
    step(state, [NO_INPUT], BOMB_FUSE_TICKS);
    expect(state.players[0].alive).toBe(true);
    expect(state.toxic[1 * state.width + 6]).toBeGreaterThan(0);
    // Il revient dans le nuage ; l'adversaire y entre une fois les flammes éteintes.
    const up = { direction: 'up', bomb: false } as const;
    const left = { direction: 'left', bomb: false } as const;
    step(state, [up], 30);
    step(state, [up, left], 30);
    expect(cellOf(state.players[0])).toEqual([5, 1]);
    expect(state.players[0].alive).toBe(true);
    step(state, [NO_INPUT, left], 30);
    expect(state.players[1].alive).toBe(false);
  });

  it('Doppelbombe (Boomette) : le leurre bloque comme une bombe mais disparaît sans exploser', () => {
    const state = arena([Hero.Boomette, Hero.Boomer]);
    step(state, [POWER]);
    const [cx, cy] = cellOf(state.players[0]);
    expect(bombAt(state, cx, cy)?.decoy).toBe(true);
    // Le leurre ne compte pas dans les bombes : Boomette en pose une vraie ailleurs.
    step(state, [{ direction: 'right', bomb: false }], 20);
    const events = step(state, [NO_INPUT], BOMB_FUSE_TICKS);
    expect(events).toContainEqual({ type: 'decoyGone', cx, cy });
    expect(events.some((event) => event.type === 'explosion')).toBe(false);
    expect(state.players[0].alive).toBe(true);
  });

  it('Copie (Omega) : utilise le pouvoir de l’adversaire le plus proche', () => {
    const state = arena([Hero.Omega, Hero.Rocco, Hero.Frost]);
    put(state, 0, 5, 5);
    put(state, 1, 6, 5);
    put(state, 2, 11, 9);
    const events = step(state, [POWER]);
    expect(events).toContainEqual({ type: 'powerUsed', player: 0, power: Hero.Rocco });
    expect(state.players[0].effect).toBe(Hero.Rocco);
  });

  it('Dash (Rocket) : 3 cases d’un coup, par-dessus une bombe', () => {
    const state = arena([Hero.Rocket, Hero.Boomer]);
    put(state, 0, 1, 1);
    put(state, 1, 11, 9);
    state.players[0].facing = 'right';
    state.bombs.push({ id: 99, owner: 1, cx: 2, cy: 1, fuse: 999, range: 1, passThrough: [], remote: false, slide: null, slideProgress: 0 });
    step(state, [POWER], 20);
    expect(state.players[0].x).toBeCloseTo(1.5 + DASH_CELLS, 0);
  });

  it('Carapace (Rocco) : survit à une explosion', () => {
    const state = arena([Hero.Rocco, Hero.Boomer]);
    step(state, [POWER]);
    step(state, [BOMB]);
    step(state, [NO_INPUT], BOMB_FUSE_TICKS);
    expect(state.players[0].alive).toBe(true);
  });

  it('suivent le personnage de chaque joueur d’une manche à l’autre', () => {
    const match = createMatch(2, 3, 'chantier', [Hero.Rocket, Hero.Toxic], true);
    expect(match.round.players.map((player) => player.character)).toEqual([Hero.Rocket, Hero.Toxic]);
    match.phase = 'roundOver';
    match.phaseTick = 10_000;
    stepMatch(match, []);
    expect(match.round.players.map((player) => player.character)).toEqual([Hero.Rocket, Hero.Toxic]);
    expect(match.round.powers).toBe(true);
  });
});
