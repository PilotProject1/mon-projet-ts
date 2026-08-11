import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateShareDto } from './dto/create-share.dto';

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async assertOwnsDocument(documentId: string, userId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.userId !== userId) {
      throw new ForbiddenException('Ce document ne vous appartient pas');
    }
  }

  private toPublicShape(link: {
    id: string;
    token: string;
    documentId: string;
    document: { name: string };
    createdAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    _count: { accesses: number };
  }) {
    return {
      id: link.id,
      token: link.token,
      documentId: link.documentId,
      documentName: link.document.name,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      revokedAt: link.revokedAt,
      accessCount: link._count.accesses,
    };
  }

  async create(dto: CreateShareDto, userId: string) {
    await this.assertOwnsDocument(dto.documentId, userId);
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000);
    const link = await this.prisma.shareLink.create({
      data: { token, expiresAt, userId, documentId: dto.documentId },
      include: {
        document: { select: { name: true } },
        _count: { select: { accesses: true } },
      },
    });
    return this.toPublicShape(link);
  }

  async findAll(userId: string) {
    const links = await this.prisma.shareLink.findMany({
      where: { userId },
      include: {
        document: { select: { name: true } },
        _count: { select: { accesses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((link) => this.toPublicShape(link));
  }

  async revoke(id: string, userId: string) {
    const link = await this.prisma.shareLink.findUnique({ where: { id } });
    if (!link) {
      throw new NotFoundException(`Lien ${id} introuvable`);
    }
    if (link.userId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce lien");
    }
    await this.prisma.shareLink.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async resolvePublicShare(token: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: { document: true },
    });
    if (!link) {
      throw new NotFoundException('Lien de partage introuvable');
    }
    if (link.revokedAt) {
      throw new GoneException('Ce lien de partage a été révoqué');
    }
    if (link.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Ce lien de partage a expiré');
    }
    await this.prisma.shareLinkAccess.create({ data: { shareLinkId: link.id } });
    return link;
  }

  getFileStream(fileKey: string) {
    return this.storage.createReadStream(fileKey);
  }
}
