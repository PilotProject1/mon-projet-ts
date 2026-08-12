import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string) {
    const company = await this.prisma.company.findUnique({ where: { ownerId: userId } });
    if (!company) {
      throw new NotFoundException("Vous n'avez pas encore créé d'entreprise");
    }
    return company;
  }

  async create(dto: CreateCompanyDto, userId: string) {
    const existing = await this.prisma.company.findUnique({ where: { ownerId: userId } });
    if (existing) {
      throw new ConflictException('Une entreprise existe déjà pour ce compte');
    }
    return this.prisma.company.create({ data: { ...dto, ownerId: userId } });
  }

  async update(dto: UpdateCompanyDto, userId: string) {
    await this.findMine(userId);
    return this.prisma.company.update({ where: { ownerId: userId }, data: dto });
  }

  /** Utilitaire pour les autres modules (Clients, Invoices) : renvoie le companyId ou lève une erreur claire. */
  async requireCompanyId(userId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({ where: { ownerId: userId } });
    if (!company) {
      throw new NotFoundException("Créez d'abord votre entreprise");
    }
    return company.id;
  }
}
