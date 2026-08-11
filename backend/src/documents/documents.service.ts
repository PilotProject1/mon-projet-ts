import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(dto: CreateDocumentDto, userId: string, file: Express.Multer.File) {
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

  async remove(id: string, userId: string) {
    const document = await this.findOne(id, userId);
    await this.prisma.document.delete({ where: { id } });
    await this.storage.delete(document.fileKey);
  }
}
