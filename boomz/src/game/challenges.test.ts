import { describe, expect, it } from 'vitest';
import {
  ALL_STARS,
  CHALLENGES,
  isUnlocked,
  parseProgress,
  recordStars,
  STAR_FAST,
  STAR_FLAWLESS,
  STAR_WIN,
  starCount,
  starsEarned,
  totalStars,
} from './challenges';
import { TICK_RATE } from './constants';
import { createMatch, stepMatch, type MatchState } from './match';
import { MAX_PLAYERS } from '../net/protocol';

function finished(scores: number[], winner: number, seconds: number): MatchState {
  const match = createMatch(scores.length, 1);
  match.phase = 'matchOver';
  match.scores = scores;
  match.matchWinner = winner;
  match.playTicks = seconds * TICK_RATE;
  return match;
}

describe('défis', () => {
  const first = CHALLENGES[0];

  it('donnent une étoile par objectif atteint, seulement en cas de victoire', () => {
    expect(starsEarned(finished([3, 0], 0, first.parSeconds), 0, first)).toBe(ALL_STARS);
    expect(starsEarned(finished([3, 1], 0, first.parSeconds + 1), 0, first)).toBe(STAR_WIN);
    expect(starsEarned(finished([3, 0], 0, first.parSeconds + 1), 0, first)).toBe(STAR_WIN | STAR_FLAWLESS);
    expect(starsEarned(finished([3, 2], 0, 10), 0, first)).toBe(STAR_WIN | STAR_FAST);
    expect(starsEarned(finished([0, 3], 1, 10), 0, first)).toBe(0);
  });

  it('comptent le temps de jeu, pas les comptes à rebours ni les pauses', () => {
    const match = createMatch(2, 1);
    for (let i = 0; i < 400; i++) stepMatch(match, []);
    expect(match.playTicks).toBeGreaterThan(0);
    expect(match.playTicks).toBeLessThan(400);
  });

  it('gardent les étoiles acquises et se débloquent dans l’ordre', () => {
    let progress = parseProgress(null);
    expect(isUnlocked(progress, 0)).toBe(true);
    expect(isUnlocked(progress, 1)).toBe(false);
    progress = recordStars(progress, 0, STAR_WIN | STAR_FAST);
    progress = recordStars(progress, 0, STAR_WIN | STAR_FLAWLESS);
    expect(progress[0]).toBe(ALL_STARS);
    expect(isUnlocked(progress, 1)).toBe(true);
    expect(totalStars(progress)).toBe(3);
    expect(starCount(STAR_WIN | STAR_FAST)).toBe(2);
  });

  it('ignorent une progression enregistrée illisible', () => {
    expect(parseProgress('pas du json')).toEqual(CHALLENGES.map(() => 0));
    expect(parseProgress('[7, "x", 99]').slice(0, 3)).toEqual([7, 0, 99 & ALL_STARS]);
  });

  it('tiennent dans un salon (joueur compris)', () => {
    for (const challenge of CHALLENGES) expect(challenge.bots.length + 1).toBeLessThanOrEqual(MAX_PLAYERS);
  });
});
