import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PLANS } from '../plans/plan.config';
import { renewalNoticeEmail } from './renewal-notice.template';

/**
 * Fenêtre légale de l'avis : au plus tôt trois mois, au plus tard un mois
 * avant le terme de la période. On vise le début de cette fenêtre — envoyer
 * au dernier moment ne laisserait pas le temps de décider, ce qui est
 * précisément ce que le texte cherche à éviter.
 */
const JOURS_AVANT_ENVOI = 75;
const JOURS_LIMITE = 31;

export interface ResumeAvisReconduction {
  examines: number;
  envoyes: number;
  echecs: number;
}

/**
 * Avis de reconduction des abonnements annuels (art. L. 215-1 du Code de la
 * consommation).
 *
 * Un contrat à tacite reconduction conclu avec un consommateur oblige
 * l'éditeur à rappeler par écrit, avant le terme, qu'il est possible de ne
 * pas reconduire. À défaut, l'abonné peut résilier à tout moment après la
 * reconduction et se faire rembourser au prorata.
 *
 * L'obligation n'existe que depuis l'ouverture de la formule annuelle : au
 * mois, l'échéance revient si souvent que la question ne se pose pas. Elle
 * est donc filtrée sur la périodicité, et non sur le plan.
 *
 * Cet envoi n'est pas un rappel de confort : il ne suit pas la préférence
 * `reminderEmails`, qu'un abonné peut couper. Le désactiver reviendrait à se
 * priver soi-même de l'information qu'on doit à son client.
 */
@Injectable()
export class RenewalNoticeService {
  private readonly logger = new Logger(RenewalNoticeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Cron('0 9 * * *', {
    name: 'avis-reconduction-annuelle',
    timeZone: 'Europe/Paris',
  })
  async runScheduled(): Promise<void> {
    const resume = await this.run();
    if (resume.examines === 0) return;
    this.logger.log(
      `Avis de reconduction : ${resume.envoyes} envoyé(s), ${resume.echecs} en erreur, ` +
        `sur ${resume.examines} abonnement(s) annuel(s) examiné(s)`,
    );
  }

  /**
   * Prévient les abonnés annuels dont la reconduction approche.
   *
   * Idempotente : `renewalNoticeSentFor` retient l'échéance déjà couverte, si
   * bien que deux passages le même jour n'envoient qu'un avis, et que celui
   * d'une année n'empêche pas celui de la suivante.
   */
  async run(now: Date = new Date()): Promise<ResumeAvisReconduction> {
    const debutFenetre = new Date(now);
    debutFenetre.setDate(debutFenetre.getDate() + JOURS_AVANT_ENVOI);
    const finFenetre = new Date(now);
    finFenetre.setDate(finFenetre.getDate() + JOURS_LIMITE);

    const abonnes = await this.prisma.user.findMany({
      where: {
        planInterval: 'annuel',
        // Un abonnement déjà résilié ne sera pas reconduit : l'avertir d'une
        // reconduction qui n'aura pas lieu serait faux.
        planCancelAtPeriodEnd: false,
        planRenewsAt: { not: null, lte: debutFenetre, gte: finFenetre },
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        planRenewsAt: true,
        renewalNoticeSentFor: true,
      },
    });

    const resume: ResumeAvisReconduction = {
      examines: abonnes.length,
      envoyes: 0,
      echecs: 0,
    };

    for (const abonne of abonnes) {
      const echeance = abonne.planRenewsAt;
      if (!echeance) continue;
      if (
        abonne.renewalNoticeSentFor &&
        abonne.renewalNoticeSentFor.getTime() === echeance.getTime()
      ) {
        continue;
      }

      const envoye = await this.mail.send(this.composer(abonne, echeance));
      if (!envoye) {
        resume.echecs += 1;
        continue;
      }

      // Marqué après l'envoi seulement : en cas d'échec, la tournée du
      // lendemain retentera, la fenêtre légale laissant de la marge.
      await this.prisma.user.update({
        where: { id: abonne.id },
        data: { renewalNoticeSentFor: echeance },
      });
      resume.envoyes += 1;
    }

    return resume;
  }

  private composer(
    abonne: { email: string; name: string; plan: keyof typeof PLANS },
    echeance: Date,
  ) {
    const jour = echeance.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const offre = PLANS[abonne.plan];
    // Même écriture que sur la page Abonnement : les centimes ne s'affichent
    // que s'il y en a, pour que l'abonné retrouve à l'euro près le montant
    // qu'on lui a annoncé au moment de souscrire.
    const montant =
      offre.yearlyPrice !== null
        ? `${
            Number.isInteger(offre.yearlyPrice)
              ? offre.yearlyPrice
              : offre.yearlyPrice.toFixed(2).replace('.', ',')
          } €`
        : null;

    return {
      to: abonne.email,
      ...renewalNoticeEmail({
        nom: abonne.name,
        offre: offre.label,
        jour,
        montant,
      }),
    };
  }
}
