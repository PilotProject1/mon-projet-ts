import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { BriefingService } from './briefing.service';
import { weeklyDigestEmail } from './weekly-digest.template';
import { envoiDu } from './weekly-digest.util';

export interface DigestRunSummary {
  examined: number;
  sent: number;
  /** Comptes n'ayant rien à signaler cette semaine. */
  nothingToSay: number;
  failed: number;
}

/**
 * Point hebdomadaire envoyé par e-mail.
 *
 * Une application de coffre-fort s'oublie entre deux démarches : on n'y
 * pense qu'au moment où l'on cherche un papier. Ce message est le seul lien
 * qui subsiste dans l'intervalle — d'où la règle qui le gouverne : il ne part
 * que lorsqu'il a quelque chose à dire. Un courriel hebdomadaire qui répète
 * chaque lundi que tout va bien est un courriel que l'on finit par filtrer,
 * et le jour où il compte, il n'est plus lu.
 */
@Injectable()
export class WeeklyDigestService {
  private readonly logger = new Logger(WeeklyDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly briefing: BriefingService,
  ) {}

  /**
   * Tentée chaque jour, et non le lundi seulement : sur un hébergement
   * gratuit l'instance dort, et un rendez-vous manqué le serait pour la
   * semaine entière. C'est `envoiDu` qui décide, pas l'horaire.
   */
  @Cron('30 8 * * *', {
    name: 'point-hebdomadaire',
    timeZone: 'Europe/Paris',
  })
  async runScheduled(): Promise<void> {
    const summary = await this.run();
    if (summary.sent > 0 || summary.failed > 0) {
      this.logger.log(
        `Point hebdomadaire : ${summary.sent} envoyé(s), ${summary.failed} en erreur, ` +
          `${summary.nothingToSay} sans rien à signaler, sur ${summary.examined} compte(s)`,
      );
    }
  }

  async run(now: Date = new Date()): Promise<DigestRunSummary> {
    const summary: DigestRunSummary = {
      examined: 0,
      sent: 0,
      nothingToSay: 0,
      failed: 0,
    };
    if (!this.mail.available) return summary;

    const users = await this.prisma.user.findMany({
      where: { weeklyDigest: true },
      select: { id: true, email: true, lastWeeklyDigestAt: true },
    });

    for (const user of users) {
      if (!envoiDu(now, user.lastWeeklyDigestAt)) continue;
      summary.examined += 1;

      try {
        const { points } = await this.briefing.forUser(user.id);
        if (points.length === 0) {
          // Rien à dire : on ne marque pas la date d'envoi, pour que le point
          // reparte dès qu'il aura quelque chose — sans attendre une semaine.
          summary.nothingToSay += 1;
          continue;
        }

        const message = weeklyDigestEmail(points);
        const envoye = await this.mail.send({ to: user.email, ...message });
        if (!envoye) {
          summary.failed += 1;
          continue;
        }

        await this.prisma.user.update({
          where: { id: user.id },
          data: { lastWeeklyDigestAt: now },
        });
        summary.sent += 1;
      } catch (error) {
        // Un compte en erreur ne doit pas priver les suivants de leur point.
        summary.failed += 1;
        this.logger.warn(
          `Point hebdomadaire impossible pour le compte ${user.id} : ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return summary;
  }
}
