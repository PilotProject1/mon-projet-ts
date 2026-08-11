import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';

@Injectable()
export class DeadlinesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDeadlineDto) {
    return this.prisma.deadline.create({
      data: { ...dto, dueDate: new Date(dto.dueDate) },
    });
  }

  findAll(userId?: string) {
    return this.prisma.deadline.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { dueDate: 'asc' },
    });
  }

  async findOne(id: string) {
    const deadline = await this.prisma.deadline.findUnique({ where: { id } });
    if (!deadline) {
      throw new NotFoundException(`Échéance ${id} introuvable`);
    }
    return deadline;
  }

  async update(id: string, dto: UpdateDeadlineDto) {
    await this.findOne(id);
    const { dueDate, ...rest } = dto;
    return this.prisma.deadline.update({
      where: { id },
      data: { ...rest, ...(dueDate ? { dueDate: new Date(dueDate) } : {}) },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.deadline.delete({ where: { id } });
  }
}
