import { WeeklyDigestService } from './weekly-digest.service';
import type { PointBriefing } from './briefing.util';

const LUNDI = new Date('2026-08-17T08:30:00Z');

const POINT: PointBriefing = {
  kind: 'echeances_depassees',
  urgence: 'urgent',
  message: '« Taxe foncière » est dépassée.',
  actionLabel: 'Voir les échéances',
  actionTo: '/echeances',
};

describe('WeeklyDigestService', () => {
  let prisma: any;
  let mail: any;
  let briefing: any;
  let service: WeeklyDigestService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'u1', email: 'loic@test.fr', lastWeeklyDigestAt: null },
          ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    mail = { available: true, send: jest.fn().mockResolvedValue(true) };
    briefing = { forUser: jest.fn().mockResolvedValue({ points: [POINT] }) };
    service = new WeeklyDigestService(prisma, mail, briefing);
  });

  it('envoie le point et note la date d’envoi', async () => {
    const résumé = await service.run(LUNDI);

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe('loic@test.fr');
    expect(mail.send.mock.calls[0][0].subject).toContain('Taxe foncière');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { lastWeeklyDigestAt: LUNDI },
    });
    expect(résumé.sent).toBe(1);
  });

  it('n’envoie rien quand il n’y a rien à dire, et ne note pas la date', async () => {
    // Ne pas noter la date est ce qui permet au point de partir dès qu'il
    // aura quelque chose, sans attendre une semaine de plus.
    briefing.forUser.mockResolvedValue({ points: [] });

    const résumé = await service.run(LUNDI);

    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(résumé.nothingToSay).toBe(1);
  });

  it('ne note pas la date quand l’envoi a échoué', async () => {
    mail.send.mockResolvedValue(false);

    const résumé = await service.run(LUNDI);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(résumé.failed).toBe(1);
  });

  it('poursuit la tournée quand un compte échoue', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@test.fr', lastWeeklyDigestAt: null },
      { id: 'u2', email: 'b@test.fr', lastWeeklyDigestAt: null },
    ]);
    briefing.forUser
      .mockRejectedValueOnce(new Error('base indisponible'))
      .mockResolvedValueOnce({ points: [POINT] });

    const résumé = await service.run(LUNDI);

    expect(résumé.failed).toBe(1);
    expect(résumé.sent).toBe(1);
  });

  it('ne fait rien sans serveur SMTP configuré', async () => {
    mail.available = false;

    const résumé = await service.run(LUNDI);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(résumé).toEqual({
      examined: 0,
      sent: 0,
      nothingToSay: 0,
      failed: 0,
    });
  });

  it('laisse de côté un compte déjà servi cette semaine', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'a@test.fr',
        lastWeeklyDigestAt: new Date('2026-08-15T08:30:00Z'),
      },
    ]);

    const résumé = await service.run(LUNDI);

    expect(briefing.forUser).not.toHaveBeenCalled();
    expect(résumé.examined).toBe(0);
  });
});
