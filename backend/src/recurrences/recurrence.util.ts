/*
 * Repérage des dépenses qui reviennent.
 *
 * Un abonnement ne se signale jamais de lui-même : il se prélève, et l'on
 * s'aperçoit un an plus tard qu'il a augmenté de trois euros. Les factures
 * conservées disent pourtant tout ce qu'il faut — un même émetteur, des
 * montants voisins, un intervalle régulier. Ce fichier ne fait que lire cela.
 *
 * Aucun appel à un modèle : le calcul est déterministe, gratuit, et rejouable
 * à l'identique. Ce qu'il affirme, il peut le justifier par des documents.
 */

/** Document réduit à ce dont le calcul a besoin. */
export interface FaitsDocument {
  id: string;
  name: string;
  provider: string | null;
  amount: number | null;
  documentDate: Date | null;
}

export type Cadence =
  'mensuelle' | 'trimestrielle' | 'semestrielle' | 'annuelle';

export interface Occurrence {
  documentId: string;
  name: string;
  date: string;
  amount: number;
}

export interface SerieRecurrente {
  provider: string;
  /** null lorsque les intervalles sont trop irréguliers pour conclure. */
  cadence: Cadence | null;
  occurrences: Occurrence[];
  /** Montant de la dernière facture connue. */
  lastAmount: number;
  /** Montant de l'avant-dernière, pour situer la dernière. */
  previousAmount: number;
  /** Écart entre les deux dernières, en euros. */
  variation: number;
  /** Le même écart en pourcentage, arrondi au dixième. */
  variationPercent: number;
  /**
   * Ce que cette dépense représente sur douze mois.
   *
   * Lorsque la cadence est reconnue, c'est le dernier montant projeté sur
   * l'année : une hausse s'y voit immédiatement, et une prime annuelle ne
   * compte pas double parce que deux échéances tombent dans la fenêtre. Sinon,
   * c'est la somme réellement constatée sur les douze derniers mois.
   */
  yearlyTotal: number;
  /** Prochaine échéance attendue, si la cadence est reconnue. */
  nextExpected: string | null;
}

/** Intervalle médian caractéristique de chaque cadence, en jours. */
const CADENCES: { cadence: Cadence; jours: number; parAn: number }[] = [
  { cadence: 'mensuelle', jours: 30, parAn: 12 },
  { cadence: 'trimestrielle', jours: 91, parAn: 4 },
  { cadence: 'semestrielle', jours: 182, parAn: 2 },
  { cadence: 'annuelle', jours: 365, parAn: 1 },
];

/** Nombre d'échéances par an d'une cadence reconnue. */
const PAR_AN: Record<Cadence, number> = Object.fromEntries(
  CADENCES.map((c) => [c.cadence, c.parAn]),
) as Record<Cadence, number>;

/**
 * Tolérance autour de l'intervalle théorique. Large à dessein : une facture
 * mensuelle tombe le 3 puis le 29, un contrat annuel se renouvelle à trois
 * semaines près. Trop stricte, la reconnaissance ne dirait jamais rien.
 */
const TOLERANCE = 0.25;

/** En deçà, la variation relève de l'arrondi et n'a rien à signaler. */
const VARIATION_MINIMALE_EUROS = 0.5;
const VARIATION_MINIMALE_POURCENT = 2;

const JOUR_MS = 86_400_000;

/** Émetteur ramené à une forme comparable : « EDF » et « edf » sont un seul. */
function clefFournisseur(provider: string): string {
  return provider
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function jourIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mediane(valeurs: number[]): number {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 1
    ? triees[milieu]
    : (triees[milieu - 1] + triees[milieu]) / 2;
}

/**
 * Cadence compatible avec ces intervalles, ou null.
 *
 * Un seul intervalle aberrant suffit à faire renoncer : mieux vaut ne pas
 * annoncer de prochaine échéance que d'en annoncer une fausse, qui ferait
 * attendre une facture qui ne viendra pas.
 */
function reconnaitreCadence(intervalles: number[]): {
  cadence: Cadence | null;
  jours: number;
} {
  const jours = mediane(intervalles);
  const candidate = CADENCES.find(
    (c) => Math.abs(jours - c.jours) <= c.jours * TOLERANCE,
  );
  if (!candidate) return { cadence: null, jours };

  const reguliers = intervalles.every(
    (i) => Math.abs(i - candidate.jours) <= candidate.jours * TOLERANCE,
  );
  return reguliers
    ? { cadence: candidate.cadence, jours }
    : { cadence: null, jours };
}

/**
 * Séries de dépenses reconnues parmi les documents fournis.
 *
 * Les séries sont rendues de la plus lourde à la plus légère : ce qui coûte
 * le plus dans l'année mérite d'être vu en premier.
 */
export function detecterRecurrences(
  documents: FaitsDocument[],
  maintenant = new Date(),
): SerieRecurrente[] {
  const groupes = new Map<
    string,
    { provider: string; docs: FaitsDocument[] }
  >();

  for (const doc of documents) {
    if (!doc.provider || doc.amount === null || !doc.documentDate) continue;
    // Un avoir ou un montant nul ne constitue pas une dépense.
    if (doc.amount <= 0) continue;

    const clef = clefFournisseur(doc.provider);
    if (!clef) continue;
    const groupe = groupes.get(clef) ?? { provider: doc.provider, docs: [] };
    groupe.docs.push(doc);
    groupes.set(clef, groupe);
  }

  const series: SerieRecurrente[] = [];
  const ilYaUnAn = maintenant.getTime() - 365 * JOUR_MS;

  for (const { provider, docs } of groupes.values()) {
    // Deux documents suffisent à parler de récurrence ; un seul ne dit rien.
    if (docs.length < 2) continue;

    const ordonnes = [...docs].sort(
      (a, b) => a.documentDate!.getTime() - b.documentDate!.getTime(),
    );

    const intervalles: number[] = [];
    for (let i = 1; i < ordonnes.length; i++) {
      const ecart =
        (ordonnes[i].documentDate!.getTime() -
          ordonnes[i - 1].documentDate!.getTime()) /
        JOUR_MS;
      // Deux factures du même jour sont un doublon, pas un intervalle.
      if (ecart >= 1) intervalles.push(ecart);
    }
    if (intervalles.length === 0) continue;

    const { cadence, jours } = reconnaitreCadence(intervalles);

    const derniere = ordonnes[ordonnes.length - 1];
    const avantDerniere = ordonnes[ordonnes.length - 2];
    const lastAmount = derniere.amount!;
    const previousAmount = avantDerniere.amount!;
    const variation = arrondir(lastAmount - previousAmount);
    const variationPercent =
      previousAmount > 0
        ? Math.round((variation / previousAmount) * 1000) / 10
        : 0;

    const yearlyTotal = arrondir(
      cadence
        ? lastAmount * PAR_AN[cadence]
        : ordonnes
            .filter((d) => d.documentDate!.getTime() >= ilYaUnAn)
            .reduce((somme, d) => somme + d.amount!, 0),
    );

    series.push({
      provider,
      cadence,
      occurrences: ordonnes.map((d) => ({
        documentId: d.id,
        name: d.name,
        date: jourIso(d.documentDate!),
        amount: d.amount!,
      })),
      lastAmount,
      previousAmount,
      variation,
      variationPercent,
      yearlyTotal,
      nextExpected: cadence
        ? jourIso(
            new Date(
              derniere.documentDate!.getTime() + Math.round(jours) * JOUR_MS,
            ),
          )
        : null,
    });
  }

  return series.sort((a, b) => b.yearlyTotal - a.yearlyTotal);
}

/** Vrai lorsque la dernière hausse mérite d'être signalée. */
export function hausseNotable(serie: SerieRecurrente): boolean {
  return (
    serie.variation >= VARIATION_MINIMALE_EUROS &&
    serie.variationPercent >= VARIATION_MINIMALE_POURCENT
  );
}

function arrondir(montant: number): number {
  return Math.round(montant * 100) / 100;
}
