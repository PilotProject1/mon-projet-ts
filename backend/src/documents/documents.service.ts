import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { OcrService } from '../analysis/ocr.service';
import {
  ExtractionService,
  type ExtractedFields,
} from '../analysis/extraction.service';
import { AiService } from '../ai/ai.service';
import { AiExtractionService } from '../ai/ai-extraction.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PlansService } from '../plans/plans.service';

/** Au-delà, la reconnaissance du type est abandonnée. */
const DETECTION_TIMEOUT_MS = 90_000;

/** Longueur de texte conservée par document. */
const MAX_TEXT_CHARS = 20_000;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('délai dépassé')), ms).unref(),
      ),
    ]);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
    private readonly extraction: ExtractionService,
    private readonly ai: AiService,
    private readonly aiExtraction: AiExtractionService,
    private readonly plans: PlansService,
  ) {}

  async create(
    dto: CreateDocumentDto,
    userId: string,
    file: Express.Multer.File,
  ) {
    // Vérifié avant l'écriture sur le stockage : sinon un fichier orphelin
    // serait déposé alors que la création est refusée.
    await this.plans.assertCanAddDocument(userId);

    const stored = await this.storage.save(file, userId);
    const detectType = dto.type === undefined;

    const document = await this.prisma.document.create({
      data: {
        name: dto.name,
        type: dto.type ?? 'autre',
        userId,
        fileKey: stored.key,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        // Un type choisi à la main ne demande aucune lecture : le document
        // est traité d'emblée.
        status: detectType ? 'en_attente' : 'traite',
      },
    });

    if (detectType) {
      // La reconnaissance passe par l'OCR, qui peut demander une minute sur
      // une photo. Elle se poursuit après la réponse : l'utilisateur voit son
      // document apparaître tout de suite, son type se préciser ensuite.
      void this.detectType(document.id, userId);
    }

    return document;
  }

  /**
   * Déduit le type d'un document de son contenu, puis le marque analysé.
   *
   * Ne lève jamais : elle s'exécute hors du cycle d'une requête. Le statut est
   * remis à « traité » même en cas d'échec, pour qu'un document ne reste pas
   * indéfiniment en attente.
   */
  private async detectType(documentId: string, userId: string): Promise<void> {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });
      if (!document) return;

      // Aucune lecture ne doit pouvoir laisser un document « en analyse »
      // indéfiniment : passé ce délai, on renonce au type et on libère la
      // ligne, quitte à ce que l'utilisateur le choisisse lui-même.
      const { fields, text } = await this.withTimeout(
        this.runExtraction(document, userId),
        DETECTION_TIMEOUT_MS,
      );
      // Une échéance déjà passée ne mérite pas d'être proposée : elle
      // n'appelle plus aucune action et polluerait l'écran.
      const dueDate = fields.suggestedDueDate
        ? new Date(`${fields.suggestedDueDate}T00:00:00.000Z`)
        : null;
      const futureDueDate =
        dueDate &&
        !Number.isNaN(dueDate.getTime()) &&
        dueDate.getTime() > Date.now()
          ? dueDate
          : null;

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'traite',
          ...(fields.suggestedType ? { type: fields.suggestedType } : {}),
          suggestedDueDate: futureDueDate,
          suggestedDueLabel: futureDueDate ? fields.suggestedDueLabel : null,
          ...this.factsFrom(fields, text),
        },
      });
      this.logger.log(
        `Document ${documentId} reconnu comme « ${fields.suggestedType ?? 'indéterminé'} »` +
          (futureDueDate
            ? `, échéance proposée le ${fields.suggestedDueDate}`
            : ''),
      );
    } catch (error) {
      this.logger.warn(
        `Reconnaissance du document ${documentId} impossible : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Le document a pu être supprimé entre-temps : l'échec est sans suite.
      await this.prisma.document
        .update({ where: { id: documentId }, data: { status: 'traite' } })
        .catch(() => undefined);
    }
  }

  findAll(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      // Le texte lu ne sort pas de la base : il pèse jusqu'à vingt mille
      // caractères par document et n'est utile qu'à la recherche.
      omit: { extractedText: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Document ${id} introuvable`);
    }
    if (document.userId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce document");
    }
    return document;
  }

  async update(id: string, dto: UpdateDocumentDto, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.document.update({ where: { id }, data: dto });
  }

  getFileStream(fileKey: string) {
    return this.storage.createReadStream(fileKey);
  }

  /**
   * Lecture du document puis extraction des champs. Partagée par l'analyse à
   * la demande et par la reconnaissance du type au dépôt, pour que les deux
   * s'appuient exactement sur le même moteur.
   */
  private async runExtraction(
    document: { fileKey: string; mimeType: string },
    userId: string,
  ): Promise<{
    fields: ExtractedFields;
    text: string;
    warning: string | null;
  }> {
    const buffer = await this.storage.getBuffer(document.fileKey);
    const { text, warning } = await this.ocr.extractText(
      buffer,
      document.mimeType,
    );

    // L'appel au modèle est facturé à la requête : il est réservé aux plans
    // incluant l'IA. Les autres comptes gardent le moteur heuristique local,
    // qui reconnaît déjà les mots caractéristiques (« facture », « assuré »…).
    const plan = await this.plans.getPlan(userId);
    const aiAllowed = this.plans.hasFeature(plan, 'ia');

    let fields: ExtractedFields | null = null;
    if (aiAllowed && this.ai.available && text.trim().length > 0) {
      try {
        fields = await this.aiExtraction.extract(text);
      } catch (err) {
        this.logger.warn(
          `Extraction IA indisponible, repli sur le moteur heuristique : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    fields ??= this.extraction.extract(text);

    return { fields, text, warning };
  }

  /**
   * Ce que la lecture a appris du document, sous la forme attendue par la
   * base. Ces champs étaient jusqu'ici calculés puis jetés : les conserver
   * est ce qui rend possible une recherche sur le contenu, et un jour le
   * repérage des dépenses récurrentes.
   */
  private factsFrom(fields: ExtractedFields, text: string) {
    const documentDate = fields.suggestedDocumentDate
      ? new Date(`${fields.suggestedDocumentDate}T00:00:00.000Z`)
      : null;
    const nettoye = text.trim();

    return {
      provider: fields.suggestedProvider,
      amount: fields.suggestedAmount,
      documentDate:
        documentDate && !Number.isNaN(documentDate.getTime())
          ? documentDate
          : null,
      // Tronqué : au-delà, une ligne de base de données porterait le poids
      // d'un fichier entier sans que la recherche y gagne quoi que ce soit.
      extractedText: nettoye ? nettoye.slice(0, MAX_TEXT_CHARS) : null,
      analyzedAt: new Date(),
    };
  }

  async analyze(id: string, userId: string) {
    const document = await this.findOne(id, userId);
    const { fields, text, warning } = await this.runExtraction(
      document,
      userId,
    );

    // L'analyse à la demande enregistre elle aussi ce qu'elle a lu : c'est
    // par elle qu'un document déposé avant cette version rejoint la
    // recherche par le contenu. Le type, lui, n'est pas touché — il a pu
    // être choisi à la main, et ce choix prime.
    await this.prisma.document.update({
      where: { id },
      data: this.factsFrom(fields, text),
    });

    return {
      warning,
      rawTextPreview: text.slice(0, 500),
      ...fields,
    };
  }

  /**
   * Transforme l'échéance repérée en véritable échéance suivie.
   *
   * C'est le geste central du service : l'utilisateur photographie un
   * document, l'application lit sa date limite, et un seul appui suffit à
   * déclencher les rappels. La suggestion est effacée dans le même
   * mouvement, pour qu'elle ne soit pas acceptée deux fois.
   */
  async acceptSuggestedDeadline(id: string, userId: string) {
    const document = await this.findOne(id, userId);
    if (!document.suggestedDueDate) {
      throw new NotFoundException('Aucune échéance proposée pour ce document');
    }

    const deadline = await this.prisma.deadline.create({
      data: {
        title: document.name,
        dueDate: document.suggestedDueDate,
        userId,
        documentId: document.id,
      },
    });

    await this.prisma.document.update({
      where: { id: document.id },
      data: { suggestedDueDate: null, suggestedDueLabel: null },
    });

    return deadline;
  }

  /** Écarte la proposition sans rien créer. */
  async dismissSuggestedDeadline(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.document.update({
      where: { id },
      data: { suggestedDueDate: null, suggestedDueLabel: null },
    });
  }

  async remove(id: string, userId: string) {
    const document = await this.findOne(id, userId);
    await this.prisma.document.delete({ where: { id } });
    await this.storage.delete(document.fileKey);
  }
}
