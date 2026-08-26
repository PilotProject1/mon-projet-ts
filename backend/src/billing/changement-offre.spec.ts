import { BillingService } from './billing.service';

/**
 * Un abonné qui a résilié garde l'accès jusqu'au terme. Pendant tout ce
 * temps, il doit pouvoir revenir sur sa décision ou choisir une autre offre.
 * Le portail Stripe ne le permet pas : il dépend d'une configuration propre à
 * chaque mode et refuse de changer d'offre un abonnement en cours de
 * résiliation. Sans les chemins testés ici, la seule issue est d'attendre la
 * fin de la période — c'est-à-dire de partir.
 */
describe('BillingService — reprise et changement d’offre', () => {
  const OLD_ENV = process.env;

  function abonnement(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      cancel_at_period_end: true,
      metadata: { userId: 'u1' },
      items: {
        data: [
          {
            id: 'si_1',
            price: { id: 'price_premium' },
            current_period_end: 1_800_000_000,
          },
        ],
      },
      ...overrides,
    };
  }

  function monter(sub: any = abonnement()) {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          stripeSubscriptionId: sub?.id ?? null,
          stripeCustomerId: 'cus_1',
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'u1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new BillingService(prisma);
    // Stripe renvoie l'abonnement tel qu'il est devenu : c'est cet objet, et
    // non celui d'avant, que le service relit pour aligner le plan.
    const update = jest.fn((_id: string, params: any) => {
      const items = params.items
        ? {
            data: [
              {
                ...sub.items.data[0],
                price: { id: params.items[0].price },
              },
            ],
          }
        : sub.items;
      return Promise.resolve({ ...sub, ...params, items });
    });
    Object.defineProperty(service, 'stripe', {
      get: () => ({
        subscriptions: {
          retrieve: jest.fn().mockResolvedValue(sub),
          update,
        },
      }),
    });
    return { service, prisma, update };
  }

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      STRIPE_SECRET_KEY: 'sk_test',
      STRIPE_PRICE_PREMIUM: 'price_premium',
      STRIPE_PRICE_PRO: 'price_pro',
      STRIPE_PRICE_PREMIUM_ANNUEL: 'price_premium_annuel',
      STRIPE_PRICE_PRO_ANNUEL: 'price_pro_annuel',
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('reprise', () => {
    it('lève la résiliation programmée', async () => {
      const { service, update } = monter();
      await expect(service.reprendreAbonnement('u1')).resolves.toEqual({
        repris: true,
      });
      expect(update).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: false,
      });
    });

    it('ne touche à rien si l’abonnement court déjà', async () => {
      const { service, update } = monter(
        abonnement({ cancel_at_period_end: false }),
      );
      await expect(service.reprendreAbonnement('u1')).resolves.toEqual({
        repris: false,
      });
      expect(update).not.toHaveBeenCalled();
    });

    it('refuse quand aucun abonnement n’est rattaché au compte', async () => {
      const { service, prisma } = monter();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.reprendreAbonnement('u1')).rejects.toThrow(
        /Aucun abonnement en cours/,
      );
    });
  });

  /*
   * Une panne de Stripe n'est pas un bogue de l'application : la dire telle
   * quelle invite à réessayer, là où « erreur interne du serveur » fait
   * abandonner.
   */
  it('traduit une panne Stripe en indisponibilité, sans rien modifier', async () => {
    const prisma: any = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'u1', stripeSubscriptionId: 'sub_1' }),
        update: jest.fn(),
      },
    };
    const service = new BillingService(prisma);
    Object.defineProperty(service, 'stripe', {
      get: () => ({
        subscriptions: {
          retrieve: () => Promise.reject(new Error('Invalid JSON received')),
        },
      }),
    });

    await expect(service.changerOffre('u1', 'pro')).rejects.toThrow(
      /momentanément indisponible/,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  describe('changement d’offre', () => {
    it('remplace le tarif de la ligne existante', async () => {
      const { service, update } = monter();
      await expect(service.changerOffre('u1', 'pro', 'annuel')).resolves.toEqual(
        { change: true },
      );
      const params = update.mock.calls[0][1];
      expect(params.items).toEqual([{ id: 'si_1', price: 'price_pro_annuel' }]);
    });

    /*
     * Demander une autre offre, c'est vouloir rester : laisser la résiliation
     * courir couperait l'accès qu'on vient d'acheter.
     */
    it('lève la résiliation programmée au passage', async () => {
      const { service, update } = monter();
      await service.changerOffre('u1', 'pro');
      expect(update.mock.calls[0][1].cancel_at_period_end).toBe(false);
    });

    /*
     * Les CGV annoncent un prélèvement « d'avance et pour la période
     * entière ». Reporter l'écart à l'échéance suivante donnerait douze mois
     * d'accès annuel avant le moindre paiement.
     */
    it('facture la différence sur-le-champ', async () => {
      const { service, update } = monter();
      await service.changerOffre('u1', 'pro');
      expect(update.mock.calls[0][1].proration_behavior).toBe('always_invoice');
    });

    it('ne réclame rien quand la carte enregistrée a suffi', async () => {
      const { service } = monter(
        abonnement({
          latest_invoice: { status: 'paid', hosted_invoice_url: 'https://f' },
        }),
      );
      const resultat = await service.changerOffre('u1', 'pro');
      expect(resultat.paiementUrl).toBeUndefined();
    });

    /*
     * Authentification bancaire ou carte refusée : annoncer un changement
     * abouti laisserait croire que c'est payé.
     */
    it('renvoie où finir un paiement resté en suspens', async () => {
      const { service } = monter(
        abonnement({
          latest_invoice: {
            status: 'open',
            hosted_invoice_url: 'https://stripe.test/facture',
          },
        }),
      );
      const resultat = await service.changerOffre('u1', 'pro');
      expect(resultat.paiementUrl).toBe('https://stripe.test/facture');
    });

    it('bascule un abonné mensuel vers l’annuel du même plan', async () => {
      const { service, update } = monter();
      await service.changerOffre('u1', 'premium', 'annuel');
      expect(update.mock.calls[0][1].items[0].price).toBe(
        'price_premium_annuel',
      );
    });

    it('ne fait rien quand le tarif demandé est déjà celui en cours', async () => {
      const { service, update } = monter(
        abonnement({ cancel_at_period_end: false }),
      );
      await expect(
        service.changerOffre('u1', 'premium', 'mensuel'),
      ).resolves.toEqual({ change: false });
      expect(update).not.toHaveBeenCalled();
    });

    it('refuse un tarif qui n’est pas configuré', async () => {
      delete process.env.STRIPE_PRICE_PRO_ANNUEL;
      const { service, update } = monter();
      await expect(service.changerOffre('u1', 'pro', 'annuel')).rejects.toThrow(
        /Aucun tarif Stripe/,
      );
      expect(update).not.toHaveBeenCalled();
    });

    /*
     * Le plan est réaligné sur ce que Stripe vient de renvoyer, par la même
     * fonction que les webhooks : sans cela, l'abonné paierait la nouvelle
     * offre sans en avoir les droits jusqu'à l'arrivée du webhook.
     */
    it('aligne aussitôt le plan sur la réponse de Stripe', async () => {
      const { service, prisma } = monter();
      await service.changerOffre('u1', 'pro');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ plan: 'pro' }),
        }),
      );
    });
  });
});
