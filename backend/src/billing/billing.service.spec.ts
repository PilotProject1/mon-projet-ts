import { BillingService } from './billing.service';

/**
 * Vérifie la logique qui traduit un abonnement Stripe en droits d'accès.
 * C'est le seul endroit où le plan d'un utilisateur change : une erreur ici
 * donne soit un accès non payé, soit un accès perdu malgré un paiement.
 */
describe('BillingService — synchronisation des abonnements', () => {
  let prisma: any;
  let service: BillingService;

  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      STRIPE_PRICE_PREMIUM: 'price_premium',
      STRIPE_PRICE_PRO: 'price_pro',
    };
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'u1' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new BillingService(prisma);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  function subscription(overrides: {
    status: string;
    priceId?: string;
    periodEnd?: number;
  }) {
    return {
      id: 'sub_1',
      customer: 'cus_1',
      status: overrides.status,
      metadata: { userId: 'u1' },
      items: {
        data: [
          {
            price: { id: overrides.priceId ?? 'price_premium' },
            current_period_end: overrides.periodEnd ?? 1_800_000_000,
          },
        ],
      },
    } as any;
  }

  /** Raccourci : applique un événement d'abonnement et rend le data du update. */
  async function applySubscription(sub: any) {
    await service.applyEvent({
      type: 'customer.subscription.updated',
      data: { object: sub },
    } as any);
    return prisma.user.update.mock.calls[0]?.[0]?.data;
  }

  it('accorde le plan correspondant au tarif payé', async () => {
    const data = await applySubscription(subscription({ status: 'active' }));
    expect(data).toMatchObject({
      plan: 'premium',
      stripeSubscriptionId: 'sub_1',
    });
  });

  it('distingue les tarifs premium et professionnel', async () => {
    const data = await applySubscription(
      subscription({ status: 'active', priceId: 'price_pro' }),
    );
    expect(data.plan).toBe('pro');
  });

  it("accorde aussi les droits pendant une période d'essai", async () => {
    const data = await applySubscription(subscription({ status: 'trialing' }));
    expect(data.plan).toBe('premium');
  });

  it('enregistre la date de renouvellement', async () => {
    const data = await applySubscription(
      subscription({ status: 'active', periodEnd: 1_800_000_000 }),
    );
    expect(data.planRenewsAt).toEqual(new Date(1_800_000_000 * 1000));
  });

  describe('retrait des droits', () => {
    const statutsSansAcces = ['canceled', 'unpaid', 'past_due', 'incomplete'];

    it.each(statutsSansAcces)(
      'ramène au plan gratuit si statut %s',
      async (status) => {
        const data = await applySubscription(subscription({ status }));
        expect(data).toMatchObject({
          plan: 'gratuit',
          stripeSubscriptionId: null,
          planRenewsAt: null,
        });
      },
    );
  });

  it('ne donne aucun droit si le tarif payé est inconnu', async () => {
    // Tarif retiré du catalogue ou clé mal configurée : on refuse plutôt que
    // d'accorder un plan au hasard.
    const data = await applySubscription(
      subscription({ status: 'active', priceId: 'price_inconnu' }),
    );
    expect(data.plan).toBe('gratuit');
  });

  it('ignore un abonnement dont le client est inconnu', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await applySubscription(subscription({ status: 'active' }));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('est idempotent : rejouer le même événement donne le même résultat', async () => {
    const sub = subscription({ status: 'active' });
    await applySubscription(sub);
    const first = prisma.user.update.mock.calls[0][0].data;
    await applySubscription(sub);
    const second = prisma.user.update.mock.calls[1][0].data;
    expect(second).toEqual(first);
  });

  it('ignore les événements sans effet sur les droits', async () => {
    await service.applyEvent({
      type: 'invoice.created',
      data: { object: {} },
    } as any);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
