import { envoiDu, estLundi } from './weekly-digest.util';
import { digestSubject } from './weekly-digest.template';
import type { PointBriefing } from './briefing.util';

const LUNDI = new Date('2026-08-17T08:30:00Z');
const MARDI = new Date('2026-08-18T08:30:00Z');

function point(message: string): PointBriefing {
  return {
    kind: 'echeances_depassees',
    urgence: 'urgent',
    message,
    actionLabel: 'Voir',
    actionTo: '/echeances',
  };
}

describe('estLundi', () => {
  it('raisonne à l’heure de Paris, pas à celle du serveur', () => {
    // 23 h 30 UTC un dimanche, c'est déjà lundi 1 h 30 à Paris.
    expect(estLundi(new Date('2026-08-16T23:30:00Z'))).toBe(true);
    expect(estLundi(new Date('2026-08-16T12:00:00Z'))).toBe(false);
  });
});

describe('envoiDu', () => {
  it('attend le lundi pour un compte qui n’a jamais reçu le point', () => {
    expect(envoiDu(MARDI, null)).toBe(false);
    expect(envoiDu(LUNDI, null)).toBe(true);
  });

  it('n’envoie pas deux fois la même semaine', () => {
    const envoyeLundi = new Date('2026-08-17T08:30:00Z');
    expect(envoiDu(new Date('2026-08-17T20:00:00Z'), envoyeLundi)).toBe(false);
    expect(envoiDu(new Date('2026-08-21T08:30:00Z'), envoyeLundi)).toBe(false);
  });

  it('repart après sept jours', () => {
    const envoyeLundi = new Date('2026-08-17T08:30:00Z');
    expect(envoiDu(new Date('2026-08-24T08:30:00Z'), envoyeLundi)).toBe(true);
  });

  it('rattrape une semaine sautée sans attendre le lundi suivant', () => {
    // La tournée du lundi n'a pas eu lieu : le mardi suivant, huit jours se
    // sont écoulés et le point part enfin.
    const envoyeIlYaHuitJours = new Date('2026-08-10T08:30:00Z');
    expect(envoiDu(MARDI, envoyeIlYaHuitJours)).toBe(true);
  });
});

describe('digestSubject', () => {
  it('reprend le point le plus urgent, et compte les autres', () => {
    const objet = digestSubject([
      point('« Taxe foncière » est dépassée.'),
      point('2 échéances arrivent dans les sept jours.'),
      point('Votre dépense chez EDF a augmenté de 15,30 €.'),
    ]);

    expect(objet).toBe('SYNeco : « Taxe foncière » est dépassée. (+ 2 autres)');
  });

  it('ne compte rien quand il n’y a qu’un point', () => {
    expect(digestSubject([point('« Assurance » est dépassée.')])).toBe(
      'SYNeco : « Assurance » est dépassée.',
    );
  });

  it('tronque plutôt que de laisser la messagerie couper n’importe où', () => {
    const objet = digestSubject([
      point(
        'Une échéance a été repérée dans « Facture de régularisation annuelle EDF du mois de septembre » et attend votre accord.',
      ),
    ]);

    expect(objet.length).toBeLessThanOrEqual(78);
    expect(objet.endsWith('…')).toBe(true);
  });
});
