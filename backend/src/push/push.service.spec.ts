import { PushService } from './push.service';

describe('PushService', () => {
  let service: PushService;
  let prisma: any;
  const cleInitiale = process.env.VAPID_PUBLIC_KEY;

  beforeEach(() => {
    prisma = {
      pushSubscription: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new PushService(prisma);
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  afterEach(() => {
    if (cleInitiale !== undefined) process.env.VAPID_PUBLIC_KEY = cleInitiale;
  });

  it('se déclare indisponible sans clés VAPID', () => {
    expect(service.available).toBe(false);
    expect(service.publicKey).toBeNull();
  });

  it('n’envoie rien tant que les clés manquent', async () => {
    await expect(
      service.sendToUser('u1', { title: 't', body: 'b', url: '/echeances' }),
    ).resolves.toBe(0);
    // Aucune lecture d'abonnement n'est même engagée.
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it('rattache un réabonnement au compte connecté plutôt que d’en créer un second', async () => {
    await service.subscribe('u1', {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'cle-publique', auth: 'secret' },
      label: 'Android · Chrome',
    });

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: 'https://push.example/abc' },
        update: expect.objectContaining({
          userId: 'u1',
          p256dh: 'cle-publique',
        }),
      }),
    );
  });

  it('ne désabonne que les appareils du compte demandeur', async () => {
    await service.unsubscribe('u1', 'https://push.example/abc');

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example/abc', userId: 'u1' },
    });
  });
});
