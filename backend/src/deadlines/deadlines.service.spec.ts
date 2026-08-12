import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeadlinesService } from './deadlines.service';

describe('DeadlinesService', () => {
  let service: DeadlinesService;
  let prisma: any;
  let notifications: any;

  const ownerId = 'user-1';
  const otherId = 'user-2';
  const deadline = {
    id: 'dl-1',
    userId: ownerId,
    title: 'Renouveler assurance',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    status: 'a_faire',
  };

  beforeEach(() => {
    prisma = {
      document: { findUnique: jest.fn() },
      deadline: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    notifications = { create: jest.fn() };

    service = new DeadlinesService(prisma, notifications);
  });

  describe('create', () => {
    it('rejects linking a deadline to a document owned by someone else', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: otherId,
      });

      await expect(
        service.create(
          { title: 'x', dueDate: '2026-01-01', documentId: 'doc-1' } as any,
          ownerId,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.deadline.create).not.toHaveBeenCalled();
    });

    it('creates a deadline with a computed priority when there is no document link', async () => {
      prisma.deadline.create.mockResolvedValue(deadline);

      const result = await service.create(
        {
          title: deadline.title,
          dueDate: deadline.dueDate.toISOString(),
        },
        ownerId,
      );

      expect(result).toHaveProperty('priority');
      expect(prisma.document.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findOne (ownership)', () => {
    it('throws NotFoundException for a missing deadline', async () => {
      prisma.deadline.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', ownerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a deadline owned by another user', async () => {
      prisma.deadline.findUnique.mockResolvedValue(deadline);

      await expect(service.findOne(deadline.id, otherId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remind', () => {
    it('rejects reminders for a deadline owned by someone else', async () => {
      prisma.deadline.findUnique.mockResolvedValue(deadline);

      await expect(service.remind(deadline.id, otherId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('creates an in-app notification for the owner', async () => {
      prisma.deadline.findUnique.mockResolvedValue(deadline);
      notifications.create.mockResolvedValue({ id: 'notif-1' });

      await service.remind(deadline.id, ownerId);

      expect(notifications.create).toHaveBeenCalledWith(
        ownerId,
        deadline.id,
        expect.stringContaining(deadline.title),
      );
    });
  });

  describe('remove', () => {
    it('blocks deletion from a non-owner', async () => {
      prisma.deadline.findUnique.mockResolvedValue(deadline);

      await expect(service.remove(deadline.id, otherId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.deadline.delete).not.toHaveBeenCalled();
    });
  });
});
