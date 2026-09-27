import { Capacitor, registerPlugin } from '@capacitor/core';
import type { MatchState } from '../game/match';
import type { SoundEvent } from './events';

/** Module natif de vibrations (ios/App/App/HapticsPlugin.swift). */
interface HapticsPlugin {
  impact(options: { style: 'light' | 'medium' | 'heavy'; intensity?: number }): Promise<void>;
  notify(options: { type: 'success' | 'warning' | 'error' }): Promise<void>;
}

const Native = registerPlugin<HapticsPlugin>('BoomzHaptics');

export type Haptic =
  | { kind: 'impact'; style: 'light' | 'medium' | 'heavy'; intensity: number }
  | { kind: 'notify'; type: 'success' | 'warning' | 'error' };

/** Distance (en cases) jusqu'à laquelle une explosion fait vibrer le téléphone. */
const FELT_WITHIN = 3;

/**
 * Distance entre le joueur de ce téléphone et la plus proche des flammes
 * apparues entre deux états (`Infinity` s'il n'y en a pas ou s'il est éliminé).
 */
export function nearestNewFlame(before: MatchState, after: MatchState, me: number | null): number {
  if (me === null || before.roundNumber !== after.roundNumber) return Infinity;
  const player = after.round.players[me];
  if (!player?.alive) return Infinity;
  const { flames, width } = after.round;
  let nearest = Infinity;
  for (let i = 0; i < flames.length; i++) {
    if (flames[i] === 0 || before.round.flames[i] > 0) continue;
    const dx = (i % width) + 0.5 - player.x;
    const dy = Math.floor(i / width) + 0.5 - player.y;
    nearest = Math.min(nearest, Math.hypot(dx, dy));
  }
  return nearest;
}

/** Vibration à produire pour ce qui vient de se passer (la plus forte l'emporte). */
export function hapticFor(events: SoundEvent[], flameDistance: number): Haptic | null {
  const kinds = new Set(events.map((event) => (('mine' in event && event.mine) ? `${event.kind}:mine` : event.kind)));
  if (kinds.has('death:mine')) return { kind: 'notify', type: 'error' };
  if (kinds.has('matchWin')) return { kind: 'notify', type: 'success' };
  if (kinds.has('vestLost:mine')) return { kind: 'impact', style: 'heavy', intensity: 1 };
  if (kinds.has('frozen:mine')) return { kind: 'notify', type: 'warning' };
  if (kinds.has('explosion') && flameDistance <= FELT_WITHIN) {
    // Plus la flamme passe près, plus le choc est fort.
    return flameDistance <= 1.5
      ? { kind: 'impact', style: 'heavy', intensity: 1 }
      : { kind: 'impact', style: 'medium', intensity: 0.6 };
  }
  if (kinds.has('roundWin')) return { kind: 'notify', type: 'success' };
  if (kinds.has('go')) return { kind: 'impact', style: 'medium', intensity: 0.8 };
  if (kinds.has('power:mine')) return { kind: 'impact', style: 'medium', intensity: 0.7 };
  if (kinds.has('bombPlaced:mine')) return { kind: 'impact', style: 'light', intensity: 0.5 };
  return null;
}

/** Vibrations du jeu : moteur haptique sur iPhone, `navigator.vibrate` ailleurs. */
export class Haptics {
  enabled: () => boolean;

  constructor(enabled: () => boolean) {
    this.enabled = enabled;
  }

  play(haptic: Haptic | null): void {
    if (!haptic || !this.enabled()) return;
    if (Capacitor.getPlatform() === 'ios') {
      const call = haptic.kind === 'impact' ? Native.impact(haptic) : Native.notify(haptic);
      void call.catch(() => {});
      return;
    }
    const pattern =
      haptic.kind === 'notify' ? (haptic.type === 'error' ? [60, 40, 120] : [30, 50, 30]) : haptic.style === 'heavy' ? 60 : haptic.style === 'medium' ? 30 : 12;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Vibrations indisponibles : sans importance.
    }
  }
}
