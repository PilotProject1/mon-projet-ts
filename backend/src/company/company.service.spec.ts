import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompanyService } from './company.service';

describe('CompanyService', () => {
  let service: CompanyService;
  let prisma: any;

  const ownerId = 'user-1';
  const company = { id: 'company-1', ownerId, name: 'Studio Design' };

  beforeEach(() => {
    prisma = {
      company: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new CompanyService(prisma);
  });

  describe('findMine', () => {
    it('throws NotFoundException when the user has no company yet', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.findMine(ownerId)).rejects.toThrow(NotFoundException);
    });

    it('returns the company owned by the user', async () => {
      prisma.company.findUnique.mockResolvedValue(company);

      await expect(service.findMine(ownerId)).resolves.toEqual(company);
    });
  });

  describe('create', () => {
    it('rejects creating a second company for the same user', async () => {
      prisma.company.findUnique.mockResolvedValue(company);

      await expect(service.create({ name: 'x' } as any, ownerId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.company.create).not.toHaveBeenCalled();
    });

    it('creates the company scoped to the requesting user', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      prisma.company.create.mockResolvedValue(company);

      await service.create({ name: 'Studio Design' } as any, ownerId);

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: { name: 'Studio Design', ownerId },
      });
    });
  });

  describe('requireCompanyId', () => {
    it('throws NotFoundException when there is no company', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.requireCompanyId(ownerId)).rejects.toThrow(NotFoundException);
    });

    it('returns the company id', async () => {
      prisma.company.findUnique.mockResolvedValue(company);

      await expect(service.requireCompanyId(ownerId)).resolves.toBe(company.id);
    });
  });
});
