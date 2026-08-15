import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import {
  daysUntil,
  reminderOffsetFor,
  REMINDER_OFFSETS,
} from './deadline-reminder.util';

const HORIZON_DAYS = Math.max(...REMINDER_OFFSETS);

export interface ReminderRunSummary {
  examined: number;
  sent: number;
  alreadySent: number;
  failed: number;
}

/**
 * Tournée quotidienne des rappels d'échéance.
 *
 * Sans elle, un rappel n'existait que si l'utilisateur le déclenchait
 * lui-même — ce qui vide de sa substance la promesse du service.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 8 * * *', {
    name: 'rappels-echeances',
    timeZone: 'Europe/Paris',
  })
  async runScheduled(): Promise<void> {
    const summary = await this.run();
    this.logger.log(
      `Tournée des rappels : ${summary.sent} envoyé(s), ${summary.alreadySent} déjà notifié(s), ` +
        `${summary.failed} en erreur, sur ${summary.examined} échéance(s) examinée(s)`,
    );
  }

  /**
   * Parcourt les échéances à venir et notifie celles qui franchissent un
   * palier. Idempotente : deux exécutions le même jour n'envoient qu'un
   * rappel.
   */
  async run(now: Date = new Date()): Promise<ReminderRunSummary> {
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + HORIZON_DAYS);
    horizon.setHours(23, 59, 59, 999);

    const deadlines = await this.prisma.deadline.findMany({
      where: { status: 'a_faire', dueDate: { lte: horizon } },
      include: {
        user: { select: { id: true, email: true, reminderEmails: true } },
      },
    });

    const summary: ReminderRunSummary = {
      examined: deadlines.length,
      sent: 0,
      alreadySent: 0,
      failed: 0,
    };

    for (const deadline of deadlines) {
      const offset = reminderOffsetFor(daysUntil(deadline.dueDate, now));
      if (offset === null) continue;

      try {
        const notification = await this.notifications.deliver({
          deadline,
          recipient: deadline.user,
          offsetDays: offset,
          now,
        });
        if (notification) summary.sent++;
        else summary.alreadySent++;
      } catch (error) {
        // Une échéance en erreur ne doit pas priver les suivantes de rappel.
        summary.failed++;
        this.logger.error(
          `Rappel impossible pour l'échéance ${deadline.id} : ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return summary;
  }
}
