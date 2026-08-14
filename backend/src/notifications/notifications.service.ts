import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { daysUntil, reminderMessage } from './deadline-reminder.util';
import { reminderEmail } from './reminder-email.template';

export interface DeadlineToNotify {
  id: string;
  title: string;
  dueDate: Date;
  userId: string;
}

export interface RecipientToNotify {
  id: string;
  email: string;
  reminderEmails: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Enregistre un rappel et tente de le porter jusqu'à la boîte mail.
   *
   * La notification est créée d'abord : l'application reste le canal sûr, et
   * `channel` n'indique « email » qu'une fois l'envoi réellement accepté par
   * le serveur SMTP.
   *
   * Renvoie null lorsque le palier a déjà donné lieu à un rappel : la
   * contrainte d'unicité tient lieu de verrou, ce qui rend la tournée
   * rejouable et supporte deux instances en parallèle.
   */
  async deliver(params: {
    deadline: DeadlineToNotify;
    recipient: RecipientToNotify;
    offsetDays: number | null;
    now?: Date;
  }): Promise<Notification | null> {
    const { deadline, recipient, offsetDays } = params;
    const now = params.now ?? new Date();
    const daysLeft = daysUntil(deadline.dueDate, now);
    const message = reminderMessage(deadline.title, deadline.dueDate, daysLeft);

    let notification: Notification;
    try {
      notification = await this.prisma.notification.create({
        data: {
          userId: recipient.id,
          deadlineId: deadline.id,
          message,
          channel: 'in_app',
          offsetDays,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }

    if (!recipient.reminderEmails) {
      return notification;
    }

    const { subject, text, html } = reminderEmail({
      title: deadline.title,
      dueDate: deadline.dueDate,
      message,
    });
    const sent = await this.mail.send({
      to: recipient.email,
      subject,
      text,
      html,
    });
    if (!sent) {
      // Le rappel reste consultable dans l'application : rien n'est perdu.
      return notification;
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { channel: 'email' },
    });
  }

  findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} introuvable`);
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        "Vous n'avez pas accès à cette notification",
      );
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async getPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reminderEmails: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return {
      emailReminders: user.reminderEmails,
      // L'interface doit pouvoir dire la vérité : sans serveur SMTP
      // configuré, activer l'option ne ferait rien partir.
      emailConfigured: this.mail.available,
    };
  }

  async updatePreferences(userId: string, emailReminders: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { reminderEmails: emailReminders },
    });
    this.logger.log(
      `Rappels par e-mail ${emailReminders ? 'activés' : 'désactivés'} pour le compte ${userId}`,
    );
    return this.getPreferences(userId);
  }
}
