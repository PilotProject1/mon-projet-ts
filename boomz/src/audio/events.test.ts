import { describe, expect, it } from 'vitest';
import { BOMB_FUSE_TICKS, COUNTDOWN_TICKS } from '../game/constants';
import { createMatch, stepMatch, type MatchState } from '../game/match';
import { applyBonus } from '../game/round';
import { Bonus, Tile, type PlayerInput } from '../game/types';
import { soundEvents, type SoundEvent } from './events';

const kinds = (events: SoundEvent[]) => events.map((event) => event.kind);

function playingMatch(): MatchState {
  const match = createMatch(2, 1);
  for (let i = 0; i < COUNTDOWN_TICKS; i++) stepMatch(match, []);
  match.round.tiles = match.round.tiles.map((tile) => (tile === Tile.Wall ? Tile.Wall : Tile.Floor));
  return match;
}

function advance(match: MatchState, ticks: number, inputs: PlayerInput[] = []): { before: MatchState; after: MatchState } {
  const before = structuredClone(match);
  for (let i = 0; i < ticks; i++) stepMatch(match, inputs);
  return { before, after: structuredClone(match) };
}

describe('sons déduits des états reçus', () => {
  it('bip à chaque seconde du compte à rebours, puis « go »', () => {
    const match = createMatch(2, 1);
    const first = advance(match, 1);
    expect(kinds(soundEvents(first.before, first.after, 0))).toEqual([]);
    const second = advance(match, 60);
    expect(kinds(soundEvents(second.before, second.after, 0))).toEqual(['countdown']);
    const go = advance(match, COUNTDOWN_TICKS);
    expect(kinds(soundEvents(go.before, go.after, 0))).toContain('go');
  });

  it('pose de bombe (la sienne), puis explosion', () => {
    const match = playingMatch();
    const placed = advance(match, 1, [{ direction: null, bomb: true }]);
    expect(soundEvents(placed.before, placed.after, 0)).toContainEqual({ kind: 'bombPlaced', mine: true });
    expect(soundEvents(placed.before, placed.after, 1)).toContainEqual({ kind: 'bombPlaced', mine: false });
    advance(match, 60, [{ direction: 'down', bomb: false }]);
    // Comme le serveur : un état tous les 3 ticks.
    const heard: string[] = [];
    for (let tick = 0; tick < BOMB_FUSE_TICKS; tick += 3) {
      const step = advance(match, 3);
      heard.push(...kinds(soundEvents(step.before, step.after, 0)));
    }
    expect(heard.filter((kind) => kind === 'explosion')).toHaveLength(1);
  });

  it('un son propre au bonus ramassé, seulement pour son propre personnage', () => {
    const match = playingMatch();
    const before = structuredClone(match);
    applyBonus(match.round.players[0], Bonus.Kick);
    applyBonus(match.round.players[1], Bonus.Vest);
    expect(soundEvents(before, match, 0)).toEqual([{ kind: 'bonus', bonus: Bonus.Kick }]);
    expect(soundEvents(before, match, 1)).toEqual([{ kind: 'bonus', bonus: Bonus.Vest }]);
  });

  it('téléportation repérée au saut de position', () => {
    const match = playingMatch();
    const before = structuredClone(match);
    match.round.players[0].x = 11.5;
    expect(soundEvents(before, match, 0)).toContainEqual({ kind: 'teleport', mine: true });
  });

  it('élimination, puis fin de manche gagnée ou perdue selon le téléphone', () => {
    const match = playingMatch();
    const before = structuredClone(match);
    match.round.players[1].alive = false;
    stepMatch(match, []);
    expect(soundEvents(before, match, 1)).toEqual(
      expect.arrayContaining([{ kind: 'death', mine: true }, { kind: 'roundLose' }]),
    );
    expect(kinds(soundEvents(before, match, 0))).toContain('roundWin');
  });
});
