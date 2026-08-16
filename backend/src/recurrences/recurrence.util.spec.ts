import {
  detecterRecurrences,
  hausseNotable,
  type FaitsDocument,
} from './recurrence.util';

const MAINTENANT = new Date('2026-08-16T12:00:00Z');

let compteur = 0;
function facture(
  provider: string,
  date: string,
  amount: number,
): FaitsDocument {
  compteur += 1;
  return {
    id: `doc${compteur}`,
    name: `Facture ${provider} ${date}`,
    provider,
    amount,
    documentDate: new Date(`${date}T00:00:00.000Z`),
  };
}

describe('detecterRecurrences', () => {
  it('reconnaît un abonnement mensuel et annonce la prochaine échéance', () => {
    const series = detecterRecurrences(
      [
        facture('Free', '2026-05-04', 29.99),
        facture('Free', '2026-06-03', 29.99),
        facture('Free', '2026-07-04', 29.99),
      ],
      MAINTENANT,
    );

    expect(series).toHaveLength(1);
    expect(series[0].cadence).toBe('mensuelle');
    expect(series[0].occurrences).toHaveLength(3);
    // 4 juillet + l'intervalle constaté : la date est attendue, pas garantie.
    expect(series[0].nextExpected).toBe('2026-08-04');
  });

  it('repère la hausse d’un abonnement, ce que personne ne surveille', () => {
    const series = detecterRecurrences(
      [
        facture('Netflix', '2026-06-15', 13.49),
        facture('Netflix', '2026-07-15', 13.49),
        facture('Netflix', '2026-08-15', 15.99),
      ],
      MAINTENANT,
    );

    expect(series[0].variation).toBe(2.5);
    expect(series[0].variationPercent).toBe(18.5);
    expect(hausseNotable(series[0])).toBe(true);
  });

  it('ne signale pas une variation de quelques centimes', () => {
    const series = detecterRecurrences(
      [
        facture('Orange', '2026-06-10', 39.99),
        facture('Orange', '2026-07-10', 40.19),
      ],
      MAINTENANT,
    );

    expect(series[0].variation).toBeCloseTo(0.2, 2);
    expect(hausseNotable(series[0])).toBe(false);
  });

  it('reconnaît une prime d’assurance annuelle', () => {
    const series = detecterRecurrences(
      [
        facture('MAIF', '2024-09-01', 412),
        facture('MAIF', '2025-09-03', 428),
        facture('MAIF', '2026-09-02', 449),
      ],
      MAINTENANT,
    );

    expect(series[0].cadence).toBe('annuelle');
    // Une prime annuelle coûte une prime par an, même lorsque deux échéances
    // tombent dans la fenêtre de douze mois.
    expect(series[0].yearlyTotal).toBe(449);
  });

  it('renonce à conclure quand les intervalles sont irréguliers', () => {
    // Des achats ponctuels chez un même marchand ne sont pas un abonnement.
    const series = detecterRecurrences(
      [
        facture('Amazon', '2026-02-03', 24.9),
        facture('Amazon', '2026-02-19', 111.4),
        facture('Amazon', '2026-07-28', 8.5),
      ],
      MAINTENANT,
    );

    expect(series[0].cadence).toBeNull();
    expect(series[0].nextExpected).toBeNull();
  });

  it('ignore un fournisseur vu une seule fois', () => {
    const series = detecterRecurrences(
      [facture('EDF', '2026-07-01', 128.4)],
      MAINTENANT,
    );

    expect(series).toEqual([]);
  });

  it('rapproche deux écritures du même émetteur malgré la casse', () => {
    const series = detecterRecurrences(
      [
        facture('EDF', '2026-06-01', 128.4),
        facture('edf', '2026-07-01', 131.2),
      ],
      MAINTENANT,
    );

    expect(series).toHaveLength(1);
    expect(series[0].occurrences).toHaveLength(2);
  });

  it('laisse de côté les documents dont la lecture n’a rien appris', () => {
    const series = detecterRecurrences(
      [
        {
          id: 'a',
          name: 'sans montant',
          provider: 'EDF',
          amount: null,
          documentDate: new Date('2026-06-01'),
        },
        {
          id: 'b',
          name: 'sans date',
          provider: 'EDF',
          amount: 90,
          documentDate: null,
        },
        facture('EDF', '2026-07-01', 128.4),
      ],
      MAINTENANT,
    );

    expect(series).toEqual([]);
  });

  it('présente d’abord ce qui pèse le plus lourd dans l’année', () => {
    const series = detecterRecurrences(
      [
        facture('Spotify', '2026-06-05', 11.99),
        facture('Spotify', '2026-07-05', 11.99),
        facture('EDF', '2026-06-01', 128.4),
        facture('EDF', '2026-07-01', 131.2),
      ],
      MAINTENANT,
    );

    expect(series.map((s) => s.provider)).toEqual(['EDF', 'Spotify']);
  });
});
