import { Injectable } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { AiService } from './ai.service';
import type { ExtractedFields } from '../analysis/extraction.service';

const DOCUMENT_TYPES: DocumentType[] = [
  'contrat',
  'facture',
  'assurance',
  'garantie',
  'courrier',
  'autre',
];

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    suggestedType: {
      anyOf: [{ type: 'string', enum: DOCUMENT_TYPES }, { type: 'null' }],
    },
    suggestedProvider: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    suggestedDates: {
      type: 'array',
      items: {
        type: 'string',
        description: 'Date au format ISO 8601 (AAAA-MM-JJ)',
      },
    },
    suggestedAmount: {
      anyOf: [{ type: 'number' }, { type: 'null' }],
    },
  },
  required: [
    'suggestedType',
    'suggestedProvider',
    'suggestedDates',
    'suggestedAmount',
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  "Tu extrais des champs structurés à partir du texte de documents administratifs français (factures, contrats, assurances, garanties, courriers). Réponds uniquement à partir du texte fourni. Si une information est absente ou incertaine, renvoie null plutôt que d'inventer une valeur.";

@Injectable()
export class AiExtractionService {
  constructor(private readonly ai: AiService) {}

  async extract(text: string): Promise<ExtractedFields> {
    const response = await this.ai.sdk.messages.create({
      model: this.ai.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 8000) }],
      output_config: {
        format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
      },
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      throw new Error('Réponse IA invalide (pas de bloc texte)');
    }
    return JSON.parse(block.text) as ExtractedFields;
  }
}
