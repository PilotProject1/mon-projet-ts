import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

const MAX_ITEMS_PER_KIND = 300;

/** Documents dont on joint un extrait de texte à la question posée. */
const MAX_PASSAGES = 25;

/** Longueur de l'extrait joint, de part et d'autre du mot trouvé. */
const PASSAGE_RADIUS = 200;

/**
 * Mots trop communs pour désigner quoi que ce soit dans un document. Sans ce
 * filtre, « quelle est ma facture » chercherait « quelle » dans tous les
 * textes et ramènerait tout.
 */
const MOTS_VIDES = new Set([
  'avec',
  'avoir',
  'cette',
  'combien',
  'comment',
  'dans',
  'depuis',
  'dernier',
  'derniere',
  'elle',
  'est-ce',
  'fait',
  'jai',
  'leur',
  'mais',
  'mes',
  'mon',
  'nous',
  'ont',
  'ou',
  'par',
  'plus',
  'pour',
  'pourquoi',
  'quand',
  'que',
  'quel',
  'quelle',
  'quelles',
  'quels',
  'qui',
  'sont',
  'sur',
  'tous',
  'toutes',
  'vous',
]);

/** Minuscules sans accents, pour comparer des mots à un texte océrisé. */
function replier(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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
  'le catalogue. Si rien ne correspond, renvoie une liste de résultats vide et explique pourquoi dans le résumé.\n' +
  'Sur un document : `documentDate` est la date portée par le document (émission, facturation) et `createdAt` seulement ' +
  "celle de son dépôt dans l'application — pour situer un document dans le temps, retiens la première quand elle existe. " +
  '`provider` et `amount` sont lus dans le document ; `amount` est le montant principal, en euros. `extrait` est un ' +
  'passage du texte du document contenant les mots de la question : appuie ta réponse dessus quand il est présent, et ' +
  "cite-le dans le résumé si cela aide l'utilisateur à reconnaître le document. Un champ absent ou nul signifie que le " +
  "document n'a pas encore été lu, pas que l'information est absente : ne conclus pas à partir d'un manque.";

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /**
   * Mots de la question susceptibles de figurer dans un document. Les mots
   * courts et les mots outils sont écartés : ils ne distinguent rien.
   */
  private motsCles(query: string): { mot: string; brut: string }[] {
    const retenus = new Map<string, string>();
    for (const brut of query.split(/[^\p{L}\p{N}]+/u)) {
      const mot = replier(brut);
      if (mot.length < 4 || MOTS_VIDES.has(mot) || retenus.has(mot)) continue;
      retenus.set(mot, brut);
      if (retenus.size === 6) break;
    }
    return [...retenus].map(([mot, brut]) => ({ mot, brut }));
  }

  /**
   * Passages des documents où figurent les mots de la question.
   *
   * Chaque mot est cherché sous sa forme écrite et sous sa forme sans
   * accents : la lecture optique restitue « echeance » là où l'utilisateur
   * tape « échéance », et l'inverse se produit tout autant.
   */
  private async findPassages(
    query: string,
    userId: string,
  ): Promise<Map<string, string>> {
    const mots = this.motsCles(query);
    if (mots.length === 0) return new Map();

    const formes = [...new Set(mots.flatMap(({ mot, brut }) => [mot, brut]))];

    const trouves = await this.prisma.document.findMany({
      where: {
        userId,
        OR: formes.map((forme) => ({
          extractedText: { contains: forme, mode: 'insensitive' as const },
        })),
      },
      select: { id: true, extractedText: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_PASSAGES,
    });

    const passages = new Map<string, string>();
    for (const doc of trouves) {
      if (!doc.extractedText) continue;
      const extrait = this.extrait(doc.extractedText, formes);
      if (extrait) passages.set(doc.id, extrait);
    }
    return passages;
  }

  /** Fragment de texte autour du premier mot trouvé. */
  private extrait(texte: string, formes: string[]): string | null {
    const repere = replier(texte);
    let position = -1;
    for (const forme of formes) {
      const at = repere.indexOf(replier(forme));
      if (at !== -1 && (position === -1 || at < position)) position = at;
    }
    if (position === -1) return null;

    const debut = Math.max(0, position - PASSAGE_RADIUS);
    const fin = Math.min(texte.length, position + PASSAGE_RADIUS);
    return (
      (debut > 0 ? '…' : '') +
      texte.slice(debut, fin).replace(/\s+/g, ' ').trim() +
      (fin < texte.length ? '…' : '')
    );
  }

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
          provider: true,
          amount: true,
          documentDate: true,
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

    // Le texte des documents ne tient pas dans une requête : on ne joint que
    // les passages où figurent les mots de la question. C'est ce qui permet
    // de répondre sur un contenu — un numéro de contrat, une mention — et
    // pas seulement sur le nom du fichier.
    const passages = await this.findPassages(query, userId);
    const catalog = {
      documents: documents.map((d) => {
        const extrait = passages.get(d.id);
        return extrait ? { ...d, extrait } : d;
      }),
      deadlines,
      contracts,
      invoices,
    };

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
