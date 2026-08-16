import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';
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
    private readonly push: PushService,
  ) {}

  /**
   * Enregistre un rappel et tente de le porter jusqu'à l'utilisateur, par
   * e-mail et par notification sur ses appareils.
   *
   * La notification est créée d'abord : l'application reste le canal sûr, et
   * `channel` ne mentionne un canal sortant qu'une fois l'envoi réellement
   * accepté — par le serveur SMTP, par le service de notification.
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

    // Les deux canaux sortants sont indépendants : chacun est tenté, aucun ne
    // conditionne l'autre, et `channel` retient ceux qui ont abouti.
    const delivered: string[] = [];

    if (recipient.reminderEmails) {
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
      if (sent) delivered.push('email');
    }

    // Aucun réglage à vérifier ici : un abonnement push n'existe que si
    // l'utilisateur a explicitement autorisé les notifications sur cet
    // appareil, et le retirer suffit à ne plus rien recevoir.
    const pushed = await this.push.sendToUser(recipient.id, {
      title: 'Rappel SYNeco',
      body: message,
      url: '/echeances',
      // Un même rappel qui reviendrait remplace le précédent au lieu de
      // s'empiler sur l'écran verrouillé.
      tag: `echeance-${deadline.id}`,
    });
    if (pushed > 0) delivered.push('push');

    if (delivered.length === 0) {
      // Le rappel reste consultable dans l'application : rien n'est perdu.
      return notification;
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { channel: delivered.join('+') },
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
      select: { reminderEmails: true, weeklyDigest: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return {
      emailReminders: user.reminderEmails,
      weeklyDigest: user.weeklyDigest,
      // L'interface doit pouvoir dire la vérité : sans serveur SMTP
      // configuré, activer l'option ne ferait rien partir.
      emailConfigured: this.mail.available,
    };
  }

  async updatePreferences(
    userId: string,
    emailReminders: boolean,
    weeklyDigest?: boolean,
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        reminderEmails: emailReminders,
        // Omis par un client qui ignore l'option : sa valeur est conservée.
        ...(weeklyDigest === undefined ? {} : { weeklyDigest }),
      },
    });
    this.logger.log(
      `Rappels par e-mail ${emailReminders ? 'activés' : 'désactivés'}` +
        (weeklyDigest === undefined
          ? ''
          : `, point hebdomadaire ${weeklyDigest ? 'activé' : 'désactivé'}`) +
        ` pour le compte ${userId}`,
    );
    return this.getPreferences(userId);
  }
}
