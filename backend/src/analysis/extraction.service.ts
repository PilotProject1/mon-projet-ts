import { Injectable } from '@nestjs/common';
import { DocumentCategory, DocumentType } from '@prisma/client';

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
  /**
   * Référence propre au document : numéro de facture, de contrat, de police,
   * ou identifiant client. C'est ce qu'un service client réclame au
   * téléphone, et ce qu'on cherche le plus longtemps dans une pile.
   */
  suggestedReference: string | null;
  /** Intitulé qui a désigné cette référence, pour savoir laquelle c'est. */
  suggestedReferenceLabel: string | null;
  /**
   * Vrai si le document se déclare acquitté, faux s'il annonce un règlement
   * à venir, null si rien ne tranche. Une facture déjà prélevée n'appelle
   * aucun rappel.
   */
  suggestedPaid: boolean | null;
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
  'OVHcloud',
  'OVH',
  'Ionos',
  'Scaleway',
  'Leroy Merlin',
  'Darty',
  'Fnac',
  'Decathlon',
  'Boulanger',
  'Enedis',
  'GRDF',
  'Eau de Paris',
  'Bouygues',
  'La Banque Postale',
  'Hello bank!',
  'Revolut',
  'N26',
  'Harmonie Mutuelle',
  'Malakoff Humanis',
  'AG2R',
  'Swisslife',
  'April',
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

/*
 * Ce qui rattache un document à un pan de la vie.
 *
 * La reconnaissance est volontairement littérale : une facture qui parle de
 * cantine scolaire est un papier de famille, une quittance de loyer un papier
 * de maison. Aucune de ces listes ne prétend être complète — elles n'ont pas
 * à l'être, puisque rien ne se range quand rien ne correspond, et que la
 * catégorie reste modifiable à la main.
 *
 * Les tournures longues sont préférées aux mots isolés, pour la même raison
 * qu'au-dessus : « assurance habitation » désigne, « assurance » ne désigne
 * rien.
 */
const CATEGORY_KEYWORDS: Record<DocumentCategory, string[]> = {
  maison: [
    'assurance habitation',
    'taxe foncière',
    "taxe d'habitation",
    'taxe d’habitation',
    'quittance de loyer',
    'contrat de bail',
    'charges de copropriété',
    'syndic de copropriété',
    'électricité',
    'gaz naturel',
    'consommation de gaz',
    'eau potable',
    'assainissement',
    'ordures ménagères',
    'compteur',
    'kwh',
    'logement',
    'locataire',
    'propriétaire',
    'loyer',
    'bail',
  ],
  personnel: [
    'assurance automobile',
    'assurance auto',
    'carte grise',
    'certificat d’immatriculation',
    "certificat d'immatriculation",
    'permis de conduire',
    'complémentaire santé',
    'mutuelle',
    'télétransmission',
    'assurance maladie',
    'numéro de sécurité sociale',
    'déclaration de revenus',
    'avis d’imposition',
    "avis d'imposition",
    'impôt sur le revenu',
    'relevé de compte',
    'épargne',
    'retraite',
    'bulletin de paie',
    'bulletin de salaire',
  ],
  famille: [
    'cantine scolaire',
    'restauration scolaire',
    'assurance scolaire',
    'inscription scolaire',
    'certificat de scolarité',
    'conseil de classe',
    'bulletin scolaire',
    'école élémentaire',
    'école maternelle',
    'collège',
    'lycée',
    'crèche',
    'périscolaire',
    'centre de loisirs',
    'allocations familiales',
    'caisse d’allocations',
    "caisse d'allocations",
    'pédiatre',
    'carnet de santé',
    'votre enfant',
  ],
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

/**
 * Position d'un nom pris comme mot entier, et non comme simple suite de
 * lettres. Sans cette précaution, « MMA » se lisait dans « Commande » : une
 * facture OVH était attribuée à un assureur, avec l'aplomb d'une certitude.
 *
 * Le voisinage est jugé sur les lettres et les chiffres seulement, pour que
 * « Canal+ » ou « Free Mobile » restent reconnaissables.
 */
function positionMot(texte: string, nom: string): number {
  const estLettre = (c: string | undefined) =>
    c !== undefined && /[a-z0-9]/.test(c);
  let depuis = 0;
  for (;;) {
    const index = texte.indexOf(nom, depuis);
    if (index === -1) return -1;
    const avant = texte[index - 1];
    const apres = texte[index + nom.length];
    const debuteMot = !estLettre(avant) || !/[a-z0-9]/.test(nom[0]);
    const finitMot = !estLettre(apres) || !/[a-z0-9]/.test(nom[nom.length - 1]);
    if (debuteMot && finitMot) return index;
    depuis = index + 1;
  }
}

const DUE_DATE_NEEDLES = DUE_DATE_PHRASES.map(replier);
const DOCUMENT_DATE_NEEDLES = DOCUMENT_DATE_PHRASES.map(replier);

/*
 * Montants en euros.
 *
 * La version précédente exigeait une frontière de mot après « € ». Or « € »
 * n'est pas un caractère de mot : la frontière n'était satisfaite que suivie
 * d'une lettre, donc jamais en fin de ligne ni devant une espace. Aucun
 * montant écrit « 6,00 € » n'était reconnu, et seul le motif inverse tirait —
 * en attrapant, sur une ligne de tableau, le nombre de la colonne suivante.
 *
 * Les espaces de groupement d'un PDF français sont souvent insécables
 * (U+00A0) ou fines insécables (U+202F) : les ignorer revenait à lire
 * « 50 000 000,00 » comme « 000,00 ».
 */
const ESPACES = '   ';
const AMOUNT_REGEX = new RegExp(
  String.raw`(?<![\d,.])(\d{1,3}(?:[${ESPACES}.]\d{3})*(?:,\d{1,2})?)[${ESPACES}]?(?:€|EUR\b)`,
  'gi',
);

/*
 * Formules qui désignent la somme réellement due, par ordre de fiabilité.
 * Sans elles, prendre le plus grand montant du document revient à retenir le
 * capital social imprimé en pied de page.
 */
const AMOUNT_PHRASES = [
  'net à payer',
  'montant à payer',
  'reste à payer',
  'total à payer',
  'total de la facture ttc',
  'montant total ttc',
  'total ttc',
  'montant ttc',
  'montant prélevé',
  'a été prélevé',
  'montant de',
];
const AMOUNT_NEEDLES = AMOUNT_PHRASES.map(replier);

/** Fenêtre de texte suivant la formule dans laquelle chercher le montant. */
const AMOUNT_WINDOW = 60;

/*
 * Intitulés qui annoncent la référence du document, du plus précis au plus
 * vague. L'ordre compte : une facture porte souvent son propre numéro et
 * celui du client, et c'est le sien qu'on cite en premier.
 */
const REFERENCE_PHRASES = [
  'référence de la facture',
  'numéro de facture',
  'n° de facture',
  'no de facture',
  'facture n°',
  'facture no',
  // La lecture optique perd souvent le degré : « facture n » doit suffire.
  // Le risque est nul, la valeur retenue devant contenir un chiffre.
  'facture n',
  'numéro de contrat',
  'n° de contrat',
  'contrat n°',
  'contrat n',
  'numéro de police',
  'police n°',
  'police n',
  'numéro de commande',
  'commande n°',
  'commande n',
  'identifiant client',
  'numéro client',
  'n° client',
  'référence client',
  'référence',
  'réf.',
];
const REFERENCE_NEEDLES = REFERENCE_PHRASES.map(replier);

/** Fenêtre suivant l'intitulé dans laquelle chercher la référence. */
const REFERENCE_WINDOW = 48;

/*
 * Une référence mêle lettres et chiffres, parfois des tirets — « FR79815011 »,
 * « sh203366-ovh », « 4839201 ». On exige au moins un chiffre et quatre
 * caractères, faute de quoi le premier mot venu ferait l'affaire.
 */
const REFERENCE_REGEX = /[A-Za-z0-9][A-Za-z0-9\-_/]{3,}/;

/*
 * Formules qui tranchent le règlement. Celles d'acquittement l'emportent :
 * une facture prélevée porte souvent aussi la mention « net à payer », qui
 * n'est qu'un intitulé de total.
 */
const PAID_PHRASES = [
  'a été prélevé',
  'a ete preleve',
  'a été payée',
  'a été réglée',
  'facture acquittée',
  'acquittée',
  'payée le',
  'réglée le',
  'paiement reçu',
  'déjà réglé',
  'ne pas régler',
  'aucune action de votre part',
];
const UNPAID_PHRASES = [
  'à régler avant',
  'à payer avant',
  'date limite de paiement',
  'reste à payer',
  'montant à régler',
  'merci de régler',
  'à régler sous',
];
const PAID_NEEDLES = PAID_PHRASES.map(replier);
const UNPAID_NEEDLES = UNPAID_PHRASES.map(replier);

/*
 * Dates écrites en toutes lettres : « 13 Août 2026 », « 1er septembre 2026 ».
 * Les documents français les impriment au moins aussi souvent qu'en chiffres,
 * et l'ancien motif, purement numérique, les ignorait entièrement.
 */
const MOIS = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
];
const TEXT_DATE_REGEX = new RegExp(
  String.raw`\b(\d{1,2})(?:er)?\s+(${MOIS.join('|')})\s+(\d{4})\b`,
  'gi',
);

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
      ...this.extractReference(rawText),
      suggestedPaid: this.extractPaid(rawText),
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

  /**
   * Toutes les dates d'un fragment, dans l'ordre où elles y figurent.
   *
   * Deux écritures cohabitent dans un même document français : « 05/09/2026 »
   * et « 13 Août 2026 ». Ne lire que la première revenait à ne rien trouver
   * sur une facture qui n'emploie que la seconde — le cas d'OVH.
   */
  private datesDe(fragment: string): { iso: string; index: number }[] {
    const trouvees: { iso: string; index: number }[] = [];

    for (const match of fragment.matchAll(DATE_REGEX)) {
      const iso = this.toIsoDate(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
      );
      if (iso) trouvees.push({ iso, index: match.index ?? 0 });
    }

    // Le repli conserve les positions ; s'il ne le peut pas, les minuscules
    // suffisent puisque les noms de mois sont cherchés sans accents.
    const replie = replier(fragment);
    const source =
      replie.length === fragment.length ? replie : fragment.toLowerCase();
    for (const match of source.matchAll(TEXT_DATE_REGEX)) {
      const mois = MOIS.indexOf(match[2].toLowerCase()) + 1;
      const iso = this.toIsoDate(Number(match[1]), mois, Number(match[3]));
      if (iso) trouvees.push({ iso, index: match.index ?? 0 });
    }

    return trouvees.sort((a, b) => a.index - b.index);
  }

  /** Première date valide d'un fragment de texte. */
  private firstDate(fragment: string): string | null {
    return this.datesDe(fragment)[0]?.iso ?? null;
  }

  private toIsoDate(day: number, month: number, annee: number): string | null {
    let year = annee;
    if (year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    if (year < 2000 || year > 2100) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private extractDates(text: string): string[] {
    const dates = new Set(this.datesDe(text).map((d) => d.iso));
    return [...dates].sort().slice(0, 5);
  }

  /**
   * Référence propre au document, et l'intitulé qui l'annonce.
   *
   * Les intitulés sont essayés du plus précis au plus vague : une facture
   * porte souvent son propre numéro et celui du client, et c'est le sien
   * qu'on cite en premier. La valeur retenue doit contenir un chiffre —
   * sans quoi « Référence : voir ci-dessous » passerait pour une référence.
   */
  private extractReference(text: string): {
    suggestedReference: string | null;
    suggestedReferenceLabel: string | null;
  } {
    const repere = replier(text);
    if (repere.length !== text.length) {
      return { suggestedReference: null, suggestedReferenceLabel: null };
    }

    for (const [rang, formule] of REFERENCE_NEEDLES.entries()) {
      let depuis = 0;
      for (;;) {
        const position = repere.indexOf(formule, depuis);
        if (position === -1) break;
        const debut = position + formule.length;
        // Les deux-points et le « n° » qui suivent parfois l'intitulé ne font
        // pas partie de la référence.
        const fenetre = text
          .slice(debut, debut + REFERENCE_WINDOW)
          .replace(/^[\s:°n#º.-]*/i, '');
        const trouve = fenetre.match(REFERENCE_REGEX);
        if (trouve && /\d/.test(trouve[0])) {
          return {
            suggestedReference: trouve[0],
            suggestedReferenceLabel: text
              .slice(position, position + REFERENCE_PHRASES[rang].length)
              .trim(),
          };
        }
        depuis = position + formule.length;
      }
    }

    return { suggestedReference: null, suggestedReferenceLabel: null };
  }

  /**
   * Le document se déclare-t-il réglé ?
   *
   * L'acquittement l'emporte sur l'annonce de règlement : une facture
   * prélevée porte souvent aussi la mention « net à payer », qui n'est qu'un
   * intitulé de total. Null quand rien ne tranche — ne rien affirmer vaut
   * mieux qu'affirmer à tort qu'une facture reste due.
   */
  private extractPaid(text: string): boolean | null {
    const repere = replier(text);
    const source = repere.length === text.length ? repere : text.toLowerCase();
    if (PAID_NEEDLES.some((formule) => source.includes(formule))) return true;
    if (UNPAID_NEEDLES.some((formule) => source.includes(formule)))
      return false;
    return null;
  }

  /** Convertit « 1 234,50 » en 1234.5, quelles que soient les espaces. */
  private static enNombre(brut: string): number {
    const valeur = Number(
      brut.replace(new RegExp(`[${ESPACES}.]`, 'g'), '').replace(',', '.'),
    );
    return Number.isNaN(valeur) ? NaN : valeur;
  }

  /**
   * Somme due par le document.
   *
   * Une formule explicite prime — « total TTC », « net à payer », « a été
   * prélevé ». À défaut seulement, le plus grand montant rencontré : c'est
   * une approximation, et elle se trompe sur une facture qui imprime le
   * capital social de son émetteur en pied de page, d'où l'ordre.
   */
  private extractAmount(text: string): number | null {
    const repere = replier(text);
    if (repere.length === text.length) {
      for (const formule of AMOUNT_NEEDLES) {
        const position = repere.indexOf(formule);
        if (position === -1) continue;
        const debut = position + formule.length;
        const fenetre = text.slice(debut, debut + AMOUNT_WINDOW);
        for (const trouve of fenetre.matchAll(AMOUNT_REGEX)) {
          const valeur = ExtractionService.enNombre(trouve[1]);
          if (!Number.isNaN(valeur)) return valeur;
        }
      }
    }

    let max: number | null = null;
    for (const match of text.matchAll(AMOUNT_REGEX)) {
      const valeur = ExtractionService.enNombre(match[1]);
      if (!Number.isNaN(valeur) && (max === null || valeur > max)) {
        max = valeur;
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
      const index = positionMot(repere, normaliser(provider));
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

  /**
   * Reconnaît la nature du document à ses mots-clés.
   *
   * Chaque mot-clé pèse son nombre de mots. Sans cela, un bon de garantie
   * partait en assurance : « garantie » figure dans les deux listes, et à
   * égalité de score c'est l'ordre de déclaration qui l'emportait. Or une
   * tournure longue désigne toujours mieux qu'un mot isolé — « garantie
   * constructeur » ne se lit que sur une garantie, quand « garantie » seul
   * se lit aussi sur un contrat d'assurance.
   */
  private guessType(text: string): DocumentType | null {
    const lower = text.toLowerCase();
    let bestType: DocumentType | null = null;
    let bestScore = 0;
    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [
      DocumentType,
      string[],
    ][]) {
      const score = keywords.reduce(
        (acc, kw) =>
          acc + (lower.includes(kw) ? kw.trim().split(/\s+/).length : 0),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
    return bestType;
  }

  /**
   * Rattache le document à un pan de la vie : maison, personnel ou famille.
   *
   * Méthode à part, et non un champ de plus dans `extract` : le classement
   * doit valoir quelle que soit la manière dont le document a été lu — par
   * le moteur local comme par le modèle. Le brancher ici, sur le seul texte,
   * évite d'avoir à le redemander à chaque fournisseur d'extraction, et à
   * s'en remettre à ce qu'il voudra bien répondre.
   *
   * Rend null si rien ne dépasse : une catégorie fausse se voit moins qu'une
   * catégorie absente, et se corrige donc moins souvent. Le doute penche du
   * côté de ne rien affirmer.
   */
  categorise(text: string): DocumentCategory | null {
    const lower = text.toLowerCase();
    let best: DocumentCategory | null = null;
    let bestScore = 0;
    let exAequo = false;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
      DocumentCategory,
      string[],
    ][]) {
      const score = keywords.reduce(
        (acc, kw) =>
          acc + (lower.includes(kw) ? kw.trim().split(/\s+/).length : 0),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        best = category;
        exAequo = false;
      } else if (score > 0 && score === bestScore) {
        // Deux pans revendiquent le document avec la même force : une
        // facture d'électricité d'un logement étudiant peut sonner maison
        // et famille à parts égales. Trancher au hasard serait pire que
        // laisser la personne le faire.
        exAequo = true;
      }
    }

    return exAequo ? null : best;
  }
}
