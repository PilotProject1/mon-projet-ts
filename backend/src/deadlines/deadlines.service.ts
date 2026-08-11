import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Deadline } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';
import { computeDeadlinePriority } from './deadline-priority.util';

function withPriority(deadline: Deadline) {
  return { ...deadline, priority: computeDeadlinePriority(deadline.dueDate, deadline.status) };
}

@Injectable()
export class DeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
    const deadline = await this.prisma.deadline.create({
      data: { ...dto, userId, dueDate: new Date(dto.dueDate) },
    });
    return withPriority(deadline);
  }

  async findAll(userId: string) {
    const deadlines = await this.prisma.deadline.findMany({
      where: { userId },
      orderBy: { dueDate: 'asc' },
    });
    return deadlines.map(withPriority);
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

  async findOneWithPriority(id: string, userId: string) {
    return withPriority(await this.findOne(id, userId));
  }

  async update(id: string, dto: UpdateDeadlineDto, userId: string) {
    await this.findOne(id, userId);
    if (dto.documentId) {
      await this.assertOwnsDocument(dto.documentId, userId);
    }
    const { dueDate, ...rest } = dto;
    const deadline = await this.prisma.deadline.update({
      where: { id },
      data: { ...rest, ...(dueDate ? { dueDate: new Date(dueDate) } : {}) },
    });
    return withPriority(deadline);
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.deadline.delete({ where: { id } });
  }

  async remind(id: string, userId: string) {
    const deadline = await this.findOne(id, userId);
    const dueDateLabel = deadline.dueDate.toISOString().slice(0, 10);
    const message = `Rappel : "${deadline.title}" à échéance le ${dueDateLabel}`;
    return this.notifications.create(userId, deadline.id, message);
  }
}
