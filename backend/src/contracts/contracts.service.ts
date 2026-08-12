import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOwnsDocument(documentId: string, userId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document || document.userId !== userId) {
      throw new ForbiddenException('Ce document ne vous appartient pas');
    }
  }

  async create(dto: CreateContractDto, userId: string) {
    await this.assertOwnsDocument(dto.documentId, userId);
    return this.prisma.contract.create({
      data: {
        ...dto,
        userId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.contract.findMany({
      where: { userId },
      orderBy: { endDate: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException(`Contrat ${id} introuvable`);
    }
    if (contract.userId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce contrat");
    }
    return contract;
  }

  async update(id: string, dto: UpdateContractDto, userId: string) {
    await this.findOne(id, userId);
    if (dto.documentId) {
      await this.assertOwnsDocument(dto.documentId, userId);
    }
    const { startDate, endDate, ...rest } = dto;
    return this.prisma.contract.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.contract.delete({ where: { id } });
  }
}
