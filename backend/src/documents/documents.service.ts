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

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

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
    return this.prisma.document.create({
      data: {
        ...dto,
        userId,
        fileKey: stored.key,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
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

  async analyze(id: string, userId: string) {
    const document = await this.findOne(id, userId);
    const buffer = await this.storage.getBuffer(document.fileKey);
    const { text, warning } = await this.ocr.extractText(
      buffer,
      document.mimeType,
    );

    // L'appel au modèle est facturé à la requête : il est réservé aux plans
    // incluant l'IA. Les autres comptes gardent le moteur heuristique local.
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

    return {
      warning,
      rawTextPreview: text.slice(0, 500),
      ...fields,
    };
  }

  async remove(id: string, userId: string) {
    const document = await this.findOne(id, userId);
    await this.prisma.document.delete({ where: { id } });
    await this.storage.delete(document.fileKey);
  }
}
