import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

const MAX_ITEMS_PER_KIND = 300;

export type SearchKind = 'document' | 'deadline' | 'contract' | 'invoice';

export interface SearchHit {
  kind: SearchKind;
  reason: string;
  item: Record<string, unknown>;
}

export interface SearchAnswer {
  summary: string;
  results: SearchHit[];
}

const SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: "Réponse courte en français à la question de l'utilisateur",
    },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['document', 'deadline', 'contract', 'invoice'],
          },
          id: {
            type: 'string',
            description: 'Copié exactement depuis le catalogue fourni',
          },
          reason: {
            type: 'string',
            description: 'Pourquoi cet élément correspond à la question',
          },
        },
        required: ['kind', 'id', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'results'],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  "Tu aides un utilisateur à retrouver ses documents, échéances, contrats et factures dans l'application SYNeco. " +
  'On te fournit un catalogue JSON de ses données (dates au format ISO). Réponds uniquement à partir de ce catalogue : ' +
  "n'invente jamais un élément qui n'y figure pas. Le champ `id` de chaque résultat doit être copié exactement depuis " +
  'le catalogue. Si rien ne correspond, renvoie une liste de résultats vide et explique pourquoi dans le résumé.';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async ask(query: string, userId: string): Promise<SearchAnswer> {
    const [documents, deadlines, contracts] = await Promise.all([
      this.prisma.document.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_ITEMS_PER_KIND,
      }),
      this.prisma.deadline.findMany({
        where: { userId },
        select: { id: true, title: true, dueDate: true, status: true },
        orderBy: { dueDate: 'desc' },
        take: MAX_ITEMS_PER_KIND,
      }),
      this.prisma.contract.findMany({
        where: { userId },
        select: {
          id: true,
          provider: true,
          startDate: true,
          endDate: true,
          amount: true,
          renewalType: true,
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_ITEMS_PER_KIND,
      }),
    ]);

    const company = await this.prisma.company.findUnique({
      where: { ownerId: userId },
    });
    const invoices = company
      ? await this.prisma.invoice.findMany({
          where: { companyId: company.id },
          select: {
            id: true,
            number: true,
            total: true,
            dueDate: true,
            status: true,
            client: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_ITEMS_PER_KIND,
        })
      : [];

    const catalog = { documents, deadlines, contracts, invoices };

    let parsed: {
      summary: string;
      results: { kind: SearchKind; id: string; reason: string }[];
    };
    try {
      const response = await this.ai.sdk.messages.create({
        model: this.ai.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Catalogue :\n${JSON.stringify(catalog)}\n\nQuestion : ${query}`,
          },
        ],
        output_config: {
          format: { type: 'json_schema', schema: SEARCH_SCHEMA },
        },
      });

      const block = response.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') {
        throw new Error('Réponse IA invalide (pas de bloc texte)');
      }
      parsed = JSON.parse(block.text) as {
        summary: string;
        results: { kind: SearchKind; id: string; reason: string }[];
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(
        `Appel IA échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        "L'assistant IA est momentanément indisponible, réessaie plus tard",
      );
    }

    // On ne fait jamais confiance aux ids renvoyés par l'IA : seuls les
    // éléments réellement possédés par l'utilisateur sont renvoyés.
    const byId: Record<SearchKind, Map<string, Record<string, unknown>>> = {
      document: new Map(documents.map((d) => [d.id, d])),
      deadline: new Map(deadlines.map((d) => [d.id, d])),
      contract: new Map(contracts.map((c) => [c.id, c])),
      invoice: new Map(invoices.map((i) => [i.id, i])),
    };

    const results: SearchHit[] = [];
    for (const hit of parsed.results) {
      const item = byId[hit.kind]?.get(hit.id);
      if (item) {
        results.push({ kind: hit.kind, reason: hit.reason, item });
      }
    }

    return { summary: parsed.summary, results };
  }
}
