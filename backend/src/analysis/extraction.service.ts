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
  /**
   * Date portée par le document : émission, établissement, facturation.
   * C'est elle qui situe une facture dans le temps — le jour du dépôt dans
   * l'application ne dit rien du mois auquel elle se rapporte.
   */
  suggestedDocumentDate: string | null;
}

/*
 * Émetteurs reconnus par le moteur local, faute de modèle.
 *
 * La liste sert surtout aux dépenses qui reviennent : sans émetteur, une
 * facture ne rejoint aucune série et l'abonnement reste invisible. D'où la
 * présence des abonnements grand public, et pas seulement des assureurs.
 * Elle ne prétend pas être exhaustive — l'extraction par le modèle, elle,
 * reconnaît n'importe quel émetteur.
 */
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
  'Sosh',
  'Red by SFR',
  'Free Mobile',
  'Netflix',
  'Spotify',
  'Deezer',
  'Canal+',
  'Disney+',
  'Basic-Fit',
  'Veolia',
  'Suez',
  'Ameli',
  'URSSAF',
  'Direction générale des finances publiques',
  'Crédit Agricole',
  'Banque Populaire',
  'Caisse d’Épargne',
  'Société Générale',
  'BNP Paribas',
  'Boursorama',
  'Fortuneo',
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

/*
 * Formules qui annoncent la date du document lui-même. Même principe que
 * ci-dessus : à défaut, on prendra la première date rencontrée, qu'un
 * document administratif imprime presque toujours dans son en-tête.
 */
const DOCUMENT_DATE_PHRASES = [
  'date de facturation',
  'date de facture',
  'date d’émission',
  "date d'émission",
  'date du document',
  'émis le',
  'établi le',
  'facture du',
  'fait le',
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

/**
 * Forme comparable d'un nom d'émetteur : minuscules, sans accents, et
 * apostrophe unifiée — un document imprime « Caisse d'Épargne » aussi
 * volontiers avec l'apostrophe droite qu'avec la courbe.
 */
function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2018\u2019`]/g, "'");
}

const DUE_DATE_NEEDLES = DUE_DATE_PHRASES.map(replier);
const DOCUMENT_DATE_NEEDLES = DOCUMENT_DATE_PHRASES.map(replier);
const AMOUNT_REGEX =
  /(\d{1,3}(?:[ .]\d{3})*(?:,\d{2})?)\s?(?:€|EUR)\b|(?:€|EUR)\s?(\d{1,3}(?:[ .]\d{3})*(?:,\d{2})?)/gi;

@Injectable()
export class ExtractionService {
  extract(rawText: string): ExtractedFields {
    const due = this.extractDueDate(rawText);
    return {
      suggestedType: this.guessType(rawText),
      suggestedProvider: this.guessProvider(rawText),
      suggestedDates: this.extractDates(rawText),
      suggestedAmount: this.extractAmount(rawText),
      suggestedDocumentDate: this.extractDocumentDate(
        rawText,
        due.suggestedDueDate,
      ),
      ...due,
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
    const trouvee = this.dateAfterPhrase(text, DUE_DATE_NEEDLES);
    return {
      suggestedDueDate: trouvee?.iso ?? null,
      suggestedDueLabel: trouvee?.label ?? null,
    };
  }

  /**
   * Date du document. À défaut de formule explicite, la première date du
   * texte : les documents administratifs la portent dans leur en-tête. Cette
   * approximation est écartée lorsqu'elle retomberait sur l'échéance, qui est
   * tout ce qu'elle n'est pas.
   */
  private extractDocumentDate(text: string, dueDate: string | null) {
    const trouvee = this.dateAfterPhrase(text, DOCUMENT_DATE_NEEDLES);
    if (trouvee) return trouvee.iso;

    const premiere = this.firstDate(text);
    return premiere && premiere !== dueDate ? premiere : null;
  }

  /**
   * Première date qui suit l'une des formules données, dans l'ordre où elles
   * sont listées — cet ordre traduit leur fiabilité.
   */
  private dateAfterPhrase(
    text: string,
    needles: string[],
  ): { iso: string; label: string } | null {
    const repere = replier(text);

    for (const phrase of needles) {
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
          return { iso, label: text.slice(at, at + phrase.length).trim() };
        }
        from = at + phrase.length;
      }
    }

    return null;
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

  /**
   * Émetteur reconnu le plus tôt dans le texte — un document annonce le sien
   * en en-tête. À position égale, le nom le plus long l'emporte : « Free
   * Mobile » désigne mieux que « Free », qu'il contient.
   */
  private guessProvider(text: string): string | null {
    const repere = normaliser(text);
    let best: { provider: string; index: number } | null = null;
    for (const provider of KNOWN_PROVIDERS) {
      const index = repere.indexOf(normaliser(provider));
      if (index === -1) continue;
      if (
        best === null ||
        index < best.index ||
        (index === best.index && provider.length > best.provider.length)
      ) {
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
