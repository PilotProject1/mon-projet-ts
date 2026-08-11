import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDocumentDto) {
    return this.prisma.document.create({ data: dto });
  }

  findAll(userId?: string) {
    return this.prisma.document.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Document ${id} introuvable`);
    }
    return document;
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.findOne(id);
    return this.prisma.document.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.document.delete({ where: { id } });
  }
}
