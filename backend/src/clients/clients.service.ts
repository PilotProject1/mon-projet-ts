import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
  ) {}

  async create(dto: CreateClientDto, userId: string) {
    const companyId = await this.companyService.requireCompanyId(userId);
    return this.prisma.client.create({ data: { ...dto, companyId } });
  }

  async findAll(userId: string) {
    const companyId = await this.companyService.requireCompanyId(userId);
    return this.prisma.client.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async findOne(id: string, userId: string) {
    const companyId = await this.companyService.requireCompanyId(userId);
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client ${id} introuvable`);
    }
    if (client.companyId !== companyId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce client");
    }
    return client;
  }

  async update(id: string, dto: UpdateClientDto, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.client.delete({ where: { id } });
  }
}
