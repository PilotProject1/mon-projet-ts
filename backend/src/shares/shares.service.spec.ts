import {
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { SharesService } from './shares.service';

describe('SharesService', () => {
  let service: SharesService;
  let prisma: any;
  let storage: any;

  const ownerId = 'user-1';
  const otherId = 'user-2';
  const shareLink = {
    id: 'share-1',
    token: 'a'.repeat(48),
    userId: ownerId,
    documentId: 'doc-1',
    document: { name: 'facture.pdf' },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null as Date | null,
    _count: { accesses: 0 },
  };

  beforeEach(() => {
    prisma = {
      document: { findUnique: jest.fn() },
      shareLink: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      shareLinkAccess: { create: jest.fn() },
    };
    storage = { createReadStream: jest.fn() };

    service = new SharesService(prisma, storage);
  });

  describe('create', () => {
    it('rejects creating a share for a document owned by someone else', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: otherId,
      });

      await expect(
        service.create(
          { documentId: 'doc-1', expiresInHours: 24 } as any,
          ownerId,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.shareLink.create).not.toHaveBeenCalled();
    });

    it('generates a random token and returns the public shape', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: ownerId,
      });
      prisma.shareLink.create.mockResolvedValue(shareLink);

      const result = await service.create(
        { documentId: 'doc-1', expiresInHours: 24 },
        ownerId,
      );

      const createArg = prisma.shareLink.create.mock.calls[0][0];
      expect(createArg.data.token).toHaveLength(48);
      expect(result).toEqual({
        id: shareLink.id,
        token: shareLink.token,
        documentId: shareLink.documentId,
        documentName: 'facture.pdf',
        createdAt: shareLink.createdAt,
        expiresAt: shareLink.expiresAt,
        revokedAt: null,
        accessCount: 0,
      });
    });
  });

  describe('revoke', () => {
    it('throws NotFoundException for an unknown link', async () => {
      prisma.shareLink.findUnique.mockResolvedValue(null);

      await expect(service.revoke('missing', ownerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects revoking a link owned by someone else', async () => {
      prisma.shareLink.findUnique.mockResolvedValue(shareLink);

      await expect(service.revoke(shareLink.id, otherId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.shareLink.update).not.toHaveBeenCalled();
    });
  });

  describe('resolvePublicShare', () => {
    it('throws NotFoundException for an invalid token', async () => {
      prisma.shareLink.findUnique.mockResolvedValue(null);

      await expect(service.resolvePublicShare('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.shareLinkAccess.create).not.toHaveBeenCalled();
    });

    it('throws GoneException for a revoked link', async () => {
      prisma.shareLink.findUnique.mockResolvedValue({
        ...shareLink,
        revokedAt: new Date(),
      });

      await expect(service.resolvePublicShare(shareLink.token)).rejects.toThrow(
        GoneException,
      );
      expect(prisma.shareLinkAccess.create).not.toHaveBeenCalled();
    });

    it('throws GoneException for an expired link', async () => {
      prisma.shareLink.findUnique.mockResolvedValue({
        ...shareLink,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resolvePublicShare(shareLink.token)).rejects.toThrow(
        GoneException,
      );
      expect(prisma.shareLinkAccess.create).not.toHaveBeenCalled();
    });

    it('logs an access and returns the link for a valid token', async () => {
      prisma.shareLink.findUnique.mockResolvedValue(shareLink);

      const result = await service.resolvePublicShare(shareLink.token);

      expect(prisma.shareLinkAccess.create).toHaveBeenCalledWith({
        data: { shareLinkId: shareLink.id },
      });
      expect(result).toBe(shareLink);
    });
  });
});
