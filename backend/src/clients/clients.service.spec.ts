import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: any;
  let companyService: any;

  const userId = 'user-1';
  const companyId = 'company-1';
  const client = { id: 'client-1', companyId, name: 'Client SARL' };

  beforeEach(() => {
    prisma = {
      client: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    companyService = {
      requireCompanyId: jest.fn().mockResolvedValue(companyId),
    };

    service = new ClientsService(prisma, companyService);
  });

  describe('create', () => {
    it("propagates the 'no company' error instead of creating an orphan client", async () => {
      companyService.requireCompanyId.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.create({ name: 'x', email: 'x@x.com' } as any, userId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.client.create).not.toHaveBeenCalled();
    });

    it('scopes the new client to the requesting company', async () => {
      prisma.client.create.mockResolvedValue(client);

      await service.create({ name: 'Client SARL', email: 'x@x.com' }, userId);

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: { name: 'Client SARL', email: 'x@x.com', companyId },
      });
    });
  });

  describe('findOne (ownership)', () => {
    it('throws NotFoundException for a missing client', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a client belonging to another company', async () => {
      prisma.client.findUnique.mockResolvedValue({
        ...client,
        companyId: 'company-2',
      });

      await expect(service.findOne(client.id, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the client for its own company', async () => {
      prisma.client.findUnique.mockResolvedValue(client);

      await expect(service.findOne(client.id, userId)).resolves.toEqual(client);
    });
  });

  describe('remove', () => {
    it('blocks deletion of a client from another company', async () => {
      prisma.client.findUnique.mockResolvedValue({
        ...client,
        companyId: 'company-2',
      });

      await expect(service.remove(client.id, userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.client.delete).not.toHaveBeenCalled();
    });
  });
});
