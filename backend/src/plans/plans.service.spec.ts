import { ForbiddenException } from '@nestjs/common';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  let prisma: any;
  let service: PlansService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      document: { count: jest.fn() },
    };
    service = new PlansService(prisma);
  });

  function onPlan(plan: string, documentCount = 0) {
    prisma.user.findUnique.mockResolvedValue({ plan });
    prisma.document.count.mockResolvedValue(documentCount);
  }

  describe('assertCanAddDocument', () => {
    it('allows an upload below the free-plan limit', async () => {
      onPlan('gratuit', 49);
      await expect(service.assertCanAddDocument('u1')).resolves.toBeUndefined();
    });

    it('refuses the upload once the free-plan limit is reached', async () => {
      onPlan('gratuit', 50);
      await expect(service.assertCanAddDocument('u1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuses when the count somehow exceeded the limit', async () => {
      onPlan('gratuit', 62);
      await expect(service.assertCanAddDocument('u1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('never counts documents on an unlimited plan', async () => {
      onPlan('premium', 10_000);
      await expect(service.assertCanAddDocument('u1')).resolves.toBeUndefined();
      expect(prisma.document.count).not.toHaveBeenCalled();
    });
  });

  describe('assertFeature', () => {
    it('refuses the AI assistant on the free plan', async () => {
      onPlan('gratuit');
      await expect(service.assertFeature('u1', 'ia')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('allows the AI assistant from the premium plan', async () => {
      onPlan('premium');
      await expect(service.assertFeature('u1', 'ia')).resolves.toBeUndefined();
    });

    it('refuses invoicing on the premium plan but allows it on pro', async () => {
      onPlan('premium');
      await expect(
        service.assertFeature('u1', 'facturation'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      onPlan('pro');
      await expect(
        service.assertFeature('u1', 'facturation'),
      ).resolves.toBeUndefined();
    });

    it('names the plans that unlock the feature', async () => {
      onPlan('gratuit');
      await expect(service.assertFeature('u1', 'facturation')).rejects.toThrow(
        /Professionnel/,
      );
    });
  });

  describe('getUsage', () => {
    it('reports the remaining quota on the free plan', async () => {
      onPlan('gratuit', 12);
      await expect(service.getUsage('u1')).resolves.toMatchObject({
        plan: 'gratuit',
        documents: { used: 12, max: 50, remaining: 38 },
      });
    });

    it('never reports a negative remaining quota', async () => {
      onPlan('gratuit', 57);
      const usage = await service.getUsage('u1');
      expect(usage.documents.remaining).toBe(0);
    });

    it('reports an unlimited quota as null', async () => {
      onPlan('pro', 843);
      await expect(service.getUsage('u1')).resolves.toMatchObject({
        documents: { used: 843, max: null, remaining: null },
      });
    });
  });
});
