import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';

@Injectable()
export class DeadlinesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOwnsDocument(documentId: string, userId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.userId !== userId) {
      throw new ForbiddenException("Ce document ne vous appartient pas");
    }
  }

  async create(dto: CreateDeadlineDto, userId: string) {
    if (dto.documentId) {
      await this.assertOwnsDocument(dto.documentId, userId);
    }
    return this.prisma.deadline.create({
      data: { ...dto, userId, dueDate: new Date(dto.dueDate) },
    });
  }

  findAll(userId: string) {
    return this.prisma.deadline.findMany({
      where: { userId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const deadline = await this.prisma.deadline.findUnique({ where: { id } });
    if (!deadline) {
      throw new NotFoundException(`Échéance ${id} introuvable`);
    }
    if (deadline.userId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à cette échéance");
    }
    return deadline;
  }

  async update(id: string, dto: UpdateDeadlineDto, userId: string) {
    await this.findOne(id, userId);
    if (dto.documentId) {
      await this.assertOwnsDocument(dto.documentId, userId);
    }
    const { dueDate, ...rest } = dto;
    return this.prisma.deadline.update({
      where: { id },
      data: { ...rest, ...(dueDate ? { dueDate: new Date(dueDate) } : {}) },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.deadline.delete({ where: { id } });
  }
}
