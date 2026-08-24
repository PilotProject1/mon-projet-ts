import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService } from './ai.service';

export type LetterKind = 'resiliation' | 'contestation';

export interface LetterFacts {
  kind: LetterKind;
  provider: string;
  reference: string | null;
  documentDate: Date | null;
  amount: number | null;
}

export interface DraftedLetter {
  subject: string;
  body: string;
}

const LETTER_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
  },
  required: ['subject', 'body'],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  "Tu rédiges des courriers administratifs français, prêts à envoyer. Utilise uniquement les faits fournis : n'invente ni référence, ni date, ni montant qui ne te serait pas donné — omets-les plutôt que de deviner. Ton formel et neutre. Ne mentionne jamais que ce courrier a été rédigé par une IA : c'est un vrai courrier, pas une note à l'utilisateur qui le lira avant de l'envoyer. Signe par l'espace réservé « [Votre nom] », puisque son identité n'est pas connue.";

/*
 * Même filet que `search.service.ts` : pas de repli heuristique côté IA
 * (contrairement à l'extraction) — le repli, c'est le gabarit `mailto:` déjà
 * écrit côté frontend, pas une seconde IA de secours ici.
 */
@Injectable()
export class AiLetterService {
  private readonly logger = new Logger(AiLetterService.name);

  constructor(private readonly ai: AiService) {}

  async draft(facts: LetterFacts): Promise<DraftedLetter> {
    const consigne =
      facts.kind === 'resiliation'
        ? `Rédige une lettre de résiliation du contrat/de l'abonnement souscrit auprès de ${facts.provider}. Demande la confirmation de la prise en compte et de la date d'effet.`
        : `Rédige une lettre contestant le montant d'une facture émise par ${facts.provider}. Explique que ce montant semble incorrect, demande une vérification et, le cas échéant, une facture rectificative.`;

    const faits = [
      `Émetteur : ${facts.provider}`,
      facts.reference ? `Référence : ${facts.reference}` : null,
      facts.documentDate
        ? `Date du document : ${facts.documentDate.toISOString().slice(0, 10)}`
        : null,
      facts.amount !== null ? `Montant : ${facts.amount.toFixed(2)} €` : null,
    ]
      .filter((ligne): ligne is string => ligne !== null)
      .join('\n');

    try {
      const response = await this.ai.sdk.messages.create({
        model: this.ai.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `${consigne}\n\nFaits connus :\n${faits}` },
        ],
        output_config: {
          format: { type: 'json_schema', schema: LETTER_SCHEMA },
        },
      });

      const block = response.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') {
        throw new Error('Réponse IA invalide (pas de bloc texte)');
      }
      return JSON.parse(block.text) as DraftedLetter;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(
        `Rédaction IA échouée : ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        "L'assistant IA est momentanément indisponible, réessaie plus tard",
      );
    }
  }
}
