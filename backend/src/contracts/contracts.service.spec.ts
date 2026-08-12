import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: any;

  const ownerId = 'user-1';
  const otherId = 'user-2';
  const contract = {
    id: 'contract-1',
    userId: ownerId,
    documentId: 'doc-1',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
  };

  beforeEach(() => {
    prisma = {
      document: { findUnique: jest.fn() },
      contract: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new ContractsService(prisma);
  });

  describe('create', () => {
    it('rejects a contract linked to a document owned by someone else', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'doc-1', userId: otherId });

      await expect(
        service.create(
          { documentId: 'doc-1', startDate: '2026-01-01', endDate: '2026-12-31' } as any,
          ownerId,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.contract.create).not.toHaveBeenCalled();
    });

    it('rejects a contract linked to a document that does not exist', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { documentId: 'ghost', startDate: '2026-01-01', endDate: '2026-12-31' } as any,
          ownerId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne (ownership)', () => {
    it('throws NotFoundException for a missing contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', ownerId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a contract owned by another user', async () => {
      prisma.contract.findUnique.mockResolvedValue(contract);

      await expect(service.findOne(contract.id, otherId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('blocks deletion from a non-owner', async () => {
      prisma.contract.findUnique.mockResolvedValue(contract);

      await expect(service.remove(contract.id, otherId)).rejects.toThrow(ForbiddenException);
      expect(prisma.contract.delete).not.toHaveBeenCalled();
    });
  });
});
