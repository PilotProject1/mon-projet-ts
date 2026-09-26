import { describe, expect, it } from 'vitest';
import { createMatch } from './game/match';
import { Tutorial } from './tutorial';

function playing() {
  const match = createMatch(2, 1, 'chantier');
  match.phase = 'playing';
  return match;
}

describe('tutoriel', () => {
  it('avance quand le joueur fait ce qui est demandé', () => {
    const tutorial = new Tutorial(true);
    const match = playing();
    tutorial.update(match, 0, [], 1);
    expect(tutorial.step).toBe('move');
    match.round.players[0].x += 2;
    expect(tutorial.update(match, 0, [], 2)).toBe(true);
    expect(tutorial.step).toBe('bomb');
    tutorial.update(match, 0, [{ kind: 'bombPlaced', mine: true }], 3);
    expect(tutorial.step).toBe('flee');
    tutorial.update(match, 0, [{ kind: 'explosion', count: 1 }], 4);
    expect(tutorial.step).toBe('kick');
    tutorial.update(match, 0, [{ kind: 'kick' }], 5);
    expect(tutorial.step).toBe('fight');
    tutorial.update(match, 0, [], 20_000);
    expect(tutorial.step).toBe('done');
  });

  it('ne compte pas la bombe d’un autre, et s’arrête à la fin du match', () => {
    const tutorial = new Tutorial(false);
    const match = playing();
    tutorial.update(match, 0, [{ kind: 'bombPlaced', mine: false }], 1);
    expect(tutorial.step).toBe('move');
    match.phase = 'matchOver';
    tutorial.update(match, 0, [], 2);
    expect(tutorial.step).toBe('done');
  });
});
