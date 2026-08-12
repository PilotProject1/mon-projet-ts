import { Injectable } from '@nestjs/common';
import { DocumentType } from '@prisma/client';

export interface ExtractedFields {
  suggestedType: DocumentType | null;
  suggestedProvider: string | null;
  suggestedDates: string[];
  suggestedAmount: number | null;
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
    };
  }

  private extractDates(text: string): string[] {
    const dates = new Set<string>();
    for (const match of text.matchAll(DATE_REGEX)) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      let year = Number(match[3]);
      if (year < 100) year += 2000;
      if (day < 1 || day > 31 || month < 1 || month > 12) continue;
      if (year < 2000 || year > 2100) continue;
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dates.add(iso);
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
