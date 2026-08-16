import { composerBriefing, type EntreesBriefing } from './briefing.util';

const MAINTENANT = new Date('2026-08-16T09:00:00Z');

function entrees(partiel: Partial<EntreesBriefing> = {}): EntreesBriefing {
  return {
    deadlines: [],
    proposees: [],
    hausses: [],
    quota: { used: 0, max: 10 },
    ...partiel,
  };
}

function le(jour: string): Date {
  return new Date(`${jour}T00:00:00.000Z`);
}

describe('composerBriefing', () => {
  it('ne dit rien quand rien n’appelle de geste', () => {
    // C'est le cas qu'on souhaite à l'utilisateur, et celui qui protège le
    // briefing : s'il parlait tous les jours, il ne serait plus lu.
    expect(composerBriefing(entrees(), MAINTENANT)).toEqual([]);
  });

  it('annonce d’abord une échéance dépassée', () => {
    const points = composerBriefing(
      entrees({
        deadlines: [
          {
            id: 'd1',
            title: 'Assurance habitation',
            dueDate: le('2026-08-20'),
          },
          { id: 'd2', title: 'Taxe foncière', dueDate: le('2026-08-10') },
        ],
      }),
      MAINTENANT,
    );

    expect(points[0].kind).toBe('echeances_depassees');
    expect(points[0].urgence).toBe('urgent');
    expect(points[0].message).toContain('Taxe foncière');
    // L'échéance à venir n'est pas noyée dans la même phrase.
    expect(points[1].kind).toBe('echeances_proches');
  });

  it('compte comme proche une échéance du jour même', () => {
    const points = composerBriefing(
      entrees({
        deadlines: [
          { id: 'd1', title: 'Facture EDF', dueDate: le('2026-08-16') },
        ],
      }),
      MAINTENANT,
    );

    expect(points).toHaveLength(1);
    expect(points[0].kind).toBe('echeances_proches');
  });

  it('ignore une échéance au-delà de la semaine', () => {
    const points = composerBriefing(
      entrees({
        deadlines: [
          { id: 'd1', title: 'Contrôle technique', dueDate: le('2026-09-30') },
        ],
      }),
      MAINTENANT,
    );

    expect(points).toEqual([]);
  });

  it('rappelle les échéances proposées qui attendent une décision', () => {
    const points = composerBriefing(
      entrees({ proposees: [{ id: 'doc1', name: 'Facture EDF août' }] }),
      MAINTENANT,
    );

    expect(points[0].kind).toBe('echeances_proposees');
    expect(points[0].message).toContain('Facture EDF août');
    expect(points[0].actionTo).toBe('/documents');
  });

  it('signale une hausse en euros, pas en pourcentage', () => {
    // Un pourcentage se compare mal ; « 15,30 € » se comprend tout de suite.
    const points = composerBriefing(
      entrees({ hausses: [{ provider: 'EDF', variation: 15.3 }] }),
      MAINTENANT,
    );

    expect(points[0].kind).toBe('hausses');
    expect(points[0].message).toContain('15,30 €');
    expect(points[0].message).toContain('EDF');
  });

  it('mentionne les autres hausses sans les énumérer', () => {
    const points = composerBriefing(
      entrees({
        hausses: [
          { provider: 'EDF', variation: 15.3 },
          { provider: 'Netflix', variation: 2.5 },
          { provider: 'Orange', variation: 3 },
        ],
      }),
      MAINTENANT,
    );

    expect(points[0].message).toContain('2 autres');
  });

  it('prévient à l’approche du quota, et le dit autrement une fois plein', () => {
    const proche = composerBriefing(
      entrees({ quota: { used: 8, max: 10 } }),
      MAINTENANT,
    );
    expect(proche[0].kind).toBe('quota');
    expect(proche[0].urgence).toBe('information');
    expect(proche[0].message).toContain('2 documents');

    const plein = composerBriefing(
      entrees({ quota: { used: 10, max: 10 } }),
      MAINTENANT,
    );
    expect(plein[0].urgence).toBe('attention');
    expect(plein[0].message).toContain('pleine');
  });

  it('ne parle jamais de quota sur une offre illimitée', () => {
    const points = composerBriefing(
      entrees({ quota: { used: 900, max: null } }),
      MAINTENANT,
    );

    expect(points).toEqual([]);
  });

  it('classe les points du plus urgent au moins pressant', () => {
    const points = composerBriefing(
      entrees({
        deadlines: [
          { id: 'd1', title: 'Taxe foncière', dueDate: le('2026-08-10') },
          { id: 'd2', title: 'Assurance', dueDate: le('2026-08-18') },
        ],
        proposees: [{ id: 'doc1', name: 'Facture EDF' }],
        hausses: [{ provider: 'EDF', variation: 15.3 }],
        quota: { used: 9, max: 10 },
      }),
      MAINTENANT,
    );

    expect(points.map((p) => p.kind)).toEqual([
      'echeances_depassees',
      'echeances_proches',
      'echeances_proposees',
      'hausses',
      'quota',
    ]);
  });
});
