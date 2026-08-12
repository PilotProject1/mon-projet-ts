import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: any;
  let companyService: any;

  const userId = 'user-1';
  const companyId = 'company-1';
  const client = { id: 'client-1', companyId };
  const invoice = {
    id: 'inv-1',
    number: 'FA-0001',
    total: 850,
    dueDate: new Date('2026-09-01'),
    status: 'brouillon',
    createdAt: new Date(),
    companyId,
    clientId: client.id,
    client: { name: 'Client SARL' },
  };

  beforeEach(() => {
    prisma = {
      client: { findUnique: jest.fn() },
      invoice: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    companyService = { requireCompanyId: jest.fn().mockResolvedValue(companyId) };

    service = new InvoicesService(prisma, companyService);
  });

  describe('create', () => {
    it('rejects a client belonging to another company', async () => {
      prisma.client.findUnique.mockResolvedValue({ ...client, companyId: 'company-2' });

      await expect(
        service.create({ clientId: client.id, total: 100, dueDate: '2026-09-01' } as any, userId),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it('auto-numbers invoices sequentially per company', async () => {
      prisma.client.findUnique.mockResolvedValue(client);
      prisma.invoice.count.mockResolvedValue(3);
      prisma.invoice.create.mockResolvedValue({ ...invoice, number: 'FA-0004' });

      await service.create(
        { clientId: client.id, total: 100, dueDate: '2026-09-01' } as any,
        userId,
      );

      const createArg = prisma.invoice.create.mock.calls[0][0];
      expect(createArg.data.number).toBe('FA-0004');
      expect(createArg.data.companyId).toBe(companyId);
    });

    it('returns the public shape with the client name flattened', async () => {
      prisma.client.findUnique.mockResolvedValue(client);
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.create.mockResolvedValue(invoice);

      const result = await service.create(
        { clientId: client.id, total: 850, dueDate: '2026-09-01' } as any,
        userId,
      );

      expect(result.clientName).toBe('Client SARL');
      expect((result as any).client).toBeUndefined();
    });
  });

  describe('findOne (ownership)', () => {
    it('throws NotFoundException for a missing invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for an invoice belonging to another company', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...invoice, companyId: 'company-2' });

      await expect(service.findOne(invoice.id, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('blocks status updates on an invoice from another company', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...invoice, companyId: 'company-2' });

      await expect(
        service.update(invoice.id, { status: 'payee' } as any, userId),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('blocks deletion of an invoice from another company', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...invoice, companyId: 'company-2' });

      await expect(service.remove(invoice.id, userId)).rejects.toThrow(ForbiddenException);
      expect(prisma.invoice.delete).not.toHaveBeenCalled();
    });
  });
});
