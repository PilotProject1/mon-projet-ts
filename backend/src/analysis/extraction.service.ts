import { Injectable } from '@nestjs/common';
import { DocumentType } from '@prisma/client';

export interface ExtractedFields {
  suggestedType: DocumentType | null;
  suggestedProvider: string | null;
  suggestedDates: string[];
  suggestedAmount: number | null;
  /**
   * Parmi toutes les dates du document, celle qui constitue une échéance —
   * et non la date d'émission. Null si aucune ne se présente comme telle :
   * mieux vaut ne rien proposer qu'une date arbitraire.
   */
  suggestedDueDate: string | null;
  /** Formule qui a désigné cette date, pour pouvoir la justifier. */
  suggestedDueLabel: string | null;
}

const KNOWN_PROVIDERS = [
  'AXA',
  'MAIF',
  'MACIF',
  'Allianz',
  'Groupama',
  'GMF',
  'Matmut',
  'MMA',
  'Generali',
  'EDF',
  'Engie',
  'TotalEnergies',
  'Orange',
  'SFR',
  'Bouygues Telecom',
  'Free',
  'La Poste',
  'CPAM',
  'Pôle Emploi',
  'CAF',
  'Amazon',
  'SNCF',
];

const TYPE_KEYWORDS: Record<DocumentType, string[]> = {
  facture: [
    'facture',
    'montant à payer',
    'total ttc',
    'total à payer',
    'échéance de paiement',
  ],
  contrat: [
    'contrat',
    'conditions générales',
    'souscription',
    'engagement',
    'durée du contrat',
  ],
  assurance: [
    'assurance',
    'sinistre',
    'assuré',
    'garantie',
    'prime annuelle',
    'police n',
  ],
  garantie: [
    'garantie constructeur',
    'sav',
    'service après-vente',
    'période de garantie',
  ],
  courrier: ['objet :', 'madame, monsieur', 'cordialement', 'veuillez agréer'],
  autre: [],
};

const DATE_REGEX = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g;

/*
 * Formules qui annoncent une échéance dans un document administratif français.
 * Lister toutes les dates ne sert à rien : sur une facture, la première est
 * presque toujours celle d'émission. Ce sont ces tournures qui distinguent la
 * date que l'utilisateur doit retenir. Elles sont classées de la plus
 * explicite à la plus vague.
 */
const DUE_DATE_PHRASES = [
  'échéance de paiement',
  'date d’échéance',
  "date d'échéance",
  'à régler avant le',
  'à régler avant',
  'à payer avant le',
  'à payer avant',
  'date limite de paiement',
  'date limite',
  'paiement avant le',
  'échéance le',
  'échéance',
  'valable jusqu’au',
  "valable jusqu'au",
  'expire le',
  'date d’expiration',
  "date d'expiration",
  'fin de validité',
  'garantie jusqu’au',
  "garantie jusqu'au",
  'fin de garantie',
  'renouvellement le',
  'jusqu’au',
  "jusqu'au",
  'avant le',
];

/** Fenêtre de texte suivant la formule dans laquelle chercher la date. */
const DUE_DATE_WINDOW = 80;

/**
 * Minuscules sans accents, en préservant la longueur d'origine.
 *
 * Indispensable ici : la lecture optique restitue souvent « ECHEANCE » sans
 * accent, et beaucoup de documents impriment leurs intitulés en capitales.
 * La longueur est préservée pour que les positions trouvées désignent le même
 * caractère dans le texte d'origine ; si une transformation venait à la
 * modifier, on renonce au repli plutôt que de décaler les indices.
 */
function replier(texte: string): string {
  const minuscules = texte.toLowerCase();
  if (minuscules.length !== texte.length) return texte;
  const sansAccents = minuscules
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return sansAccents.length === texte.length ? sansAccents : minuscules;
}

const DUE_DATE_NEEDLES = DUE_DATE_PHRASES.map(replier);
const AMOUNT_REGEX =
  /(\d{1,3}(?:[ .]\d{3})*(?:,\d{2})?)\s?(?:€|EUR)\b|(?:€|EUR)\s?(\d{1,3}(?:[ .]\d{3})*(?:,\d{2})?)/gi;

@Injectable()
export class ExtractionService {
  extract(rawText: string): ExtractedFields {
    return {
      suggestedType: this.guessType(rawText),
      suggestedProvider: this.guessProvider(rawText),
      suggestedDates: this.extractDates(rawText),
      suggestedAmount: this.extractAmount(rawText),
      ...this.extractDueDate(rawText),
    };
  }

  /**
   * Cherche une date précédée d'une formule d'échéance. La première formule
   * de la liste qui aboutit l'emporte, l'ordre traduisant leur fiabilité.
   */
  private extractDueDate(text: string): {
    suggestedDueDate: string | null;
    suggestedDueLabel: string | null;
  } {
    const repere = replier(text);

    for (const phrase of DUE_DATE_NEEDLES) {
      let from = 0;
      for (;;) {
        const at = repere.indexOf(phrase, from);
        if (at === -1) break;

        const suite = text.slice(
          at + phrase.length,
          at + phrase.length + DUE_DATE_WINDOW,
        );
        const iso = this.firstDate(suite);
        if (iso) {
          // L'intitulé est repris tel qu'il figure dans le document, pour que
          // l'utilisateur retrouve la ligne d'origine d'un coup d'œil.
          return {
            suggestedDueDate: iso,
            suggestedDueLabel: text.slice(at, at + phrase.length).trim(),
          };
        }
        from = at + phrase.length;
      }
    }

    return { suggestedDueDate: null, suggestedDueLabel: null };
  }

  /** Première date valide d'un fragment de texte. */
  private firstDate(fragment: string): string | null {
    for (const match of fragment.matchAll(DATE_REGEX)) {
      const iso = this.toIsoDate(match);
      if (iso) return iso;
    }
    return null;
  }

  private toIsoDate(match: RegExpMatchArray): string | null {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    if (year < 2000 || year > 2100) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private extractDates(text: string): string[] {
    const dates = new Set<string>();
    for (const match of text.matchAll(DATE_REGEX)) {
      const iso = this.toIsoDate(match);
      if (iso) dates.add(iso);
    }
    return [...dates].sort().slice(0, 5);
  }

  private extractAmount(text: string): number | null {
    let max: number | null = null;
    for (const match of text.matchAll(AMOUNT_REGEX)) {
      const raw = (match[1] ?? match[2] ?? '')
        .replace(/[ .]/g, '')
        .replace(',', '.');
      const value = Number(raw);
      if (!Number.isNaN(value) && (max === null || value > max)) {
        max = value;
      }
    }
    return max;
  }

  private guessProvider(text: string): string | null {
    const lower = text.toLowerCase();
    let best: { provider: string; index: number } | null = null;
    for (const provider of KNOWN_PROVIDERS) {
      const index = lower.indexOf(provider.toLowerCase());
      if (index !== -1 && (best === null || index < best.index)) {
        best = { provider, index };
      }
    }
    return best?.provider ?? null;
  }

  private guessType(text: string): DocumentType | null {
    const lower = text.toLowerCase();
    let bestType: DocumentType | null = null;
    let bestScore = 0;
    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [
      DocumentType,
      string[],
    ][]) {
      const score = keywords.reduce(
        (acc, kw) => acc + (lower.includes(kw) ? 1 : 0),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
    return bestType;
  }
}
