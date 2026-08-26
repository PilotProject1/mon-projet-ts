import { RenewalNoticeService } from './renewal-notice.service';

/**
 * L'avis de reconduction n'est pas un rappel de confort : ne pas l'envoyer
 * ouvre à l'abonné un droit de résiliation à tout moment avec remboursement
 * au prorata. L'envoyer deux fois, à l'inverse, donne l'image d'un service
 * qui harcèle. Les deux travers se jouent ici.
 */
describe('RenewalNoticeService', () => {
  const MAINTENANT = new Date('2026-03-01T09:00:00.000Z');
  /** Dans la fenêtre : 60 jours plus tard. */
  const ECHEANCE = new Date('2026-04-30T00:00:00.000Z');

  function monter(abonnes: any[], envoiReussi = true) {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue(abonnes),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const mail = { send: jest.fn().mockResolvedValue(envoiReussi) };
    const service = new RenewalNoticeService(prisma as any, mail as any);
    return { service, prisma, mail };
  }

  const abonne = {
    id: 'u1',
    email: 'camille@exemple.fr',
    name: 'Camille',
    plan: 'premium' as const,
    planRenewsAt: ECHEANCE,
    renewalNoticeSentFor: null,
  };

  it('prévient un abonné annuel dont la reconduction approche', async () => {
    const { service, mail, prisma } = monter([abonne]);
    const resume = await service.run(MAINTENANT);

    expect(resume).toEqual({ examines: 1, envoyes: 1, echecs: 0 });
    const message = mail.send.mock.calls[0][0];
    expect(message.to).toBe('camille@exemple.fr');
    expect(message.subject).toContain('30 avril 2026');
    expect(message.text).toContain('49,90 €');
    expect(message.text).toContain('L. 215-1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { renewalNoticeSentFor: ECHEANCE },
    });
  });

  /*
   * Le montant annoncé doit s'écrire comme sur la page Abonnement : « 199 € »
   * et non « 199,00 € ». Un abonné qui compare les deux ne doit pas avoir à se
   * demander s'il s'agit du même prix.
   */
  it('écrit le montant sans centimes superflus', async () => {
    const { service, mail } = monter([{ ...abonne, plan: 'pro' }]);
    await service.run(MAINTENANT);

    expect(mail.send.mock.calls[0][0].text).toContain('199 €');
  });

  it('ne cible que les abonnements annuels encore reconductibles', async () => {
    const { service, prisma } = monter([]);
    await service.run(MAINTENANT);

    const filtre = prisma.user.findMany.mock.calls[0][0].where;
    expect(filtre.planInterval).toBe('annuel');
    expect(filtre.planCancelAtPeriodEnd).toBe(false);
    // Fenêtre légale : au plus tôt 3 mois, au plus tard 1 mois avant.
    expect(filtre.planRenewsAt.lte.getTime()).toBeGreaterThan(
      filtre.planRenewsAt.gte.getTime(),
    );
  });

  it('n’envoie pas deux fois l’avis d’une même échéance', async () => {
    const { service, mail } = monter([
      { ...abonne, renewalNoticeSentFor: ECHEANCE },
    ]);
    const resume = await service.run(MAINTENANT);

    expect(mail.send).not.toHaveBeenCalled();
    expect(resume).toEqual({ examines: 1, envoyes: 0, echecs: 0 });
  });

  /*
   * L'avis de l'an dernier ne vaut pas pour cette année : c'est la raison
   * pour laquelle on retient une date et non un simple booléen.
   */
  it('renvoie l’avis quand l’échéance a changé', async () => {
    const { service, mail } = monter([
      { ...abonne, renewalNoticeSentFor: new Date('2025-04-30T00:00:00.000Z') },
    ]);
    const resume = await service.run(MAINTENANT);

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(resume.envoyes).toBe(1);
  });

  /*
   * Un envoi raté ne doit pas être marqué comme fait : la tournée du
   * lendemain retentera, la fenêtre légale laissant plusieurs semaines.
   */
  it('ne marque rien quand l’envoi échoue', async () => {
    const { service, prisma } = monter([abonne], false);
    const resume = await service.run(MAINTENANT);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(resume).toEqual({ examines: 1, envoyes: 0, echecs: 1 });
  });
});
