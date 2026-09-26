import { describe, expect, it } from 'vitest';
import { composeFeedback, describeDevice, median } from './feedback';

describe('avis des testeurs', () => {
  it('reconnaît les téléphones courants', () => {
    expect(
      describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'),
    ).toBe('iPhone (iOS 17.4)');
    expect(
      describeDevice('Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'),
    ).toBe('SM-S911B (Android 14)');
    expect(describeDevice('Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe(
      'K (Android 13)',
    );
  });

  it('compose un message court avec les seules réponses données', () => {
    const text = composeFeedback(
      { note: '4', priseEnMain: 'Compris tout seul', reactivite: 'Petit décalage', sons: '', bonusFort: 'Kick', arene: '', bug: '', remarque: 'Top !' },
      { device: 'iPhone (iOS 17.4)', screen: '390 × 844 portrait', network: '4g', latencyMs: 85, lastMatch: 'dernier match à 3 joueurs' },
    );
    expect(text).toContain('Note : ★★★★☆ (4/5)');
    expect(text).toContain('Bonus trop fort : Kick');
    expect(text).not.toContain('Sons et musique');
    expect(text).toContain('délai ≈ 85 ms');
  });

  it('prend la valeur médiane des mesures de délai', () => {
    expect(median([300, 80, 90, 85, 70])).toBe(85);
    expect(median([])).toBeNull();
  });
});
