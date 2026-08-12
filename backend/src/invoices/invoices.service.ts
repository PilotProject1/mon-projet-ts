import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
  ) {}

  private toPublicShape(invoice: {
    id: string;
    number: string;
    total: number;
    dueDate: Date;
    status: string;
    createdAt: Date;
    clientId: string;
    client: { name: string };
  }) {
    return {
      id: invoice.id,
      number: invoice.number,
      total: invoice.total,
      dueDate: invoice.dueDate,
      status: invoice.status,
      createdAt: invoice.createdAt,
      clientId: invoice.clientId,
      clientName: invoice.client.name,
    };
  }

  private async assertClientBelongsToCompany(
    clientId: string,
    companyId: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client || client.companyId !== companyId) {
      throw new ForbiddenException(
        'Ce client ne fait pas partie de votre entreprise',
      );
    }
  }

  async create(dto: CreateInvoiceDto, userId: string) {
    const companyId = await this.companyService.requireCompanyId(userId);
    await this.assertClientBelongsToCompany(dto.clientId, companyId);

    const count = await this.prisma.invoice.count({ where: { companyId } });
    const number = `FA-${String(count + 1).padStart(4, '0')}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        clientId: dto.clientId,
        total: dto.total,
        dueDate: new Date(dto.dueDate),
        companyId,
        number,
      },
      include: { client: { select: { name: true } } },
    });
    return this.toPublicShape(invoice);
  }

  async findAll(userId: string) {
    const companyId = await this.companyService.requireCompanyId(userId);
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map((invoice) => this.toPublicShape(invoice));
  }

  async findOne(id: string, userId: string) {
    const companyId = await this.companyService.requireCompanyId(userId);
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Facture ${id} introuvable`);
    }
    if (invoice.companyId !== companyId) {
      throw new ForbiddenException("Vous n'avez pas accès à cette facture");
    }
    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto, userId: string) {
    await this.findOne(id, userId);
    const { dueDate, ...rest } = dto;
    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: { ...rest, ...(dueDate ? { dueDate: new Date(dueDate) } : {}) },
      include: { client: { select: { name: true } } },
    });
    return this.toPublicShape(invoice);
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.invoice.delete({ where: { id } });
  }
}
