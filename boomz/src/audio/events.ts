import { COUNTDOWN_TICKS, SUDDEN_DEATH_TICKS, TICK_RATE } from '../game/constants';
import type { MatchState } from '../game/match';
import { Bonus, Feature, Tile, type Player } from '../game/types';

/** Ce qui s'est passé entre deux états reçus, du point de vue du son. */
export type SoundEvent =
  | { kind: 'countdown' }
  | { kind: 'go' }
  | { kind: 'bombPlaced'; mine: boolean }
  | { kind: 'explosion'; count: number }
  | { kind: 'crate' }
  | { kind: 'kick' }
  | { kind: 'teleport'; mine: boolean }
  | { kind: 'collapse' }
  | { kind: 'bonus'; bonus: Exclude<Bonus, 0> }
  | { kind: 'vestLost'; mine: boolean }
  | { kind: 'death'; mine: boolean }
  | { kind: 'suddenDeath' }
  | { kind: 'roundWin' }
  | { kind: 'roundLose' }
  | { kind: 'matchWin' }
  | { kind: 'matchLose' };

/** Au-delà de ce saut entre deux états (en cases), c'est une téléportation. */
const TELEPORT_JUMP = 1.5;

/** Bonus ramassé par un joueur, déduit de l'évolution de ses caractéristiques. */
function bonusGained(before: Player, after: Player): Exclude<Bonus, 0>[] {
  const gained: Exclude<Bonus, 0>[] = [];
  if (after.range > before.range) gained.push(Bonus.Flame);
  if (after.maxBombs > before.maxBombs) gained.push(Bonus.Bomb);
  if (after.speed > before.speed + 1e-9) gained.push(Bonus.Speed);
  if (after.vest && !before.vest) gained.push(Bonus.Vest);
  if (after.detonator && !before.detonator) gained.push(Bonus.Detonator);
  if (after.wallPass && !before.wallPass) gained.push(Bonus.WallPass);
  if (after.bombPass && !before.bombPass) gained.push(Bonus.BombPass);
  if (after.kick && !before.kick) gained.push(Bonus.Kick);
  return gained;
}

function countdownSecond(match: MatchState): number {
  return Math.ceil((COUNTDOWN_TICKS - match.phaseTick) / TICK_RATE);
}

/**
 * Compare deux états successifs reçus du serveur et en déduit les sons à
 * jouer. `me` est le numéro du joueur de ce téléphone (ou `null`).
 */
export function soundEvents(before: MatchState | null, after: MatchState, me: number | null): SoundEvent[] {
  const events: SoundEvent[] = [];
  if (!before) return events;

  if (after.phase === 'countdown') {
    const second = countdownSecond(after);
    if (before.phase !== 'countdown' || countdownSecond(before) !== second) events.push({ kind: 'countdown' });
    return events;
  }
  if (after.phase === 'playing' && before.phase === 'countdown') events.push({ kind: 'go' });
  if (after.phase === 'roundOver' && before.phase === 'playing') {
    events.push({ kind: after.roundWinner !== null && after.roundWinner === me ? 'roundWin' : 'roundLose' });
  }
  if (after.phase === 'matchOver' && before.phase !== 'matchOver') {
    events.push({ kind: after.matchWinner !== null && after.matchWinner === me ? 'matchWin' : 'matchLose' });
  }
  if (before.roundNumber !== after.roundNumber) return events;

  const a = before.round;
  const b = after.round;

  const beforeIds = new Set(a.bombs.map((bomb) => bomb.id));
  const afterIds = new Set(b.bombs.map((bomb) => bomb.id));
  for (const bomb of b.bombs) {
    if (!beforeIds.has(bomb.id)) events.push({ kind: 'bombPlaced', mine: bomb.owner === me });
    const previous = a.bombs.find((candidate) => candidate.id === bomb.id);
    if (previous && !previous.slide && bomb.slide) events.push({ kind: 'kick' });
  }
  // Une bombe disparue sous une flamme a explosé (sinon, le mur du resserrement l'a écrasée).
  const exploded = a.bombs.filter(
    (bomb) => !afterIds.has(bomb.id) && b.flames[bomb.cy * b.width + bomb.cx] > 0,
  ).length;
  if (exploded > 0) events.push({ kind: 'explosion', count: exploded });

  let crate = false;
  let collapse = false;
  for (let i = 0; i < b.tiles.length; i++) {
    if (a.tiles[i] === Tile.Block && b.tiles[i] === Tile.Burning) crate = true;
    if (a.features[i] === Feature.Cracked && b.tiles[i] === Tile.Pit) collapse = true;
  }
  if (crate) events.push({ kind: 'crate' });
  if (collapse) events.push({ kind: 'collapse' });

  for (const player of b.players) {
    const previous = a.players[player.id];
    if (!previous) continue;
    const mine = player.id === me;
    if (previous.alive && !player.alive) {
      events.push({ kind: 'death', mine });
      continue;
    }
    if (!player.alive) continue;
    if (Math.hypot(player.x - previous.x, player.y - previous.y) > TELEPORT_JUMP) {
      events.push({ kind: 'teleport', mine });
    }
    if (previous.vest && !player.vest) events.push({ kind: 'vestLost', mine });
    // Chaque bonus a son propre son, joué pour ses propres ramassages seulement.
    if (mine) for (const bonus of bonusGained(previous, player)) events.push({ kind: 'bonus', bonus });
  }

  if (a.tick < SUDDEN_DEATH_TICKS && b.tick >= SUDDEN_DEATH_TICKS) events.push({ kind: 'suddenDeath' });
  return events;
}
