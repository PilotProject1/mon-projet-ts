import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  label?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Chemin ouvert au clic, relatif à l'application. */
  url: string;
  /** Deux notifications de même étiquette se remplacent au lieu de s'empiler. */
  tag?: string;
}

/**
 * Notifications push (protocole Web Push).
 *
 * Facultatif, comme le reste : sans clés VAPID, l'application fonctionne et
 * l'interface ne propose simplement pas l'option.
 *
 * Le serveur n'envoie rien de lisible par le service de notification du
 * navigateur : le contenu est chiffré avec les clés fournies par l'abonné.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private configured = false;

  constructor(private readonly prisma: PrismaService) {}

  get available(): boolean {
    return Boolean(
      process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
    );
  }

  get publicKey(): string | null {
    return this.available ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
  }

  /**
   * Le sujet VAPID identifie l'expéditeur auprès du service de notification,
   * qui s'en sert pour signaler un problème. Le protocole accepte une adresse
   * e-mail ou une URL ; l'adresse publique du site fait un repli valide.
   */
  private get subject(): string {
    const declared = process.env.VAPID_SUBJECT;
    if (declared) return declared;
    const origin = (process.env.FRONTEND_ORIGIN ?? 'https://localhost')
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');
    return origin.startsWith('http') ? origin : `mailto:${origin}`;
  }

  private configure(): void {
    if (this.configured) return;
    webpush.setVapidDetails(
      this.subject,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    this.configured = true;
  }

  /**
   * Enregistre l'abonnement d'un navigateur. L'adresse étant unique, un
   * réabonnement du même appareil met simplement à jour ses clés — et le
   * rattache au compte connecté, si l'appareil change de main.
   */
  async subscribe(userId: string, input: PushSubscriptionInput) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        label: input.label ?? null,
        userId,
      },
      update: {
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        label: input.label ?? null,
        userId,
      },
    });
    return { subscribed: true };
  }

  /** Le désabonnement est restreint au propriétaire de l'abonnement. */
  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
    return { subscribed: false };
  }

  async countFor(userId: string): Promise<number> {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }

  /**
   * Envoie une notification à tous les appareils d'un compte.
   * Renvoie le nombre d'appareils réellement atteints.
   *
   * Ne lève jamais : un appareil injoignable ne doit pas interrompre la
   * tournée des rappels.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    if (!this.available) return 0;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) return 0;

    this.configure();
    let delivered = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        );
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404 et 410 signifient que le navigateur a révoqué l'abonnement :
        // le conserver ne ferait qu'échouer à chaque envoi.
        if (status === 404 || status === 410) {
          await this.prisma.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
          this.logger.log(`Abonnement push périmé retiré (compte ${userId})`);
        } else {
          this.logger.warn(
            `Notification push refusée (compte ${userId}, code ${status ?? 'inconnu'}) : ` +
              (error instanceof Error ? error.message : String(error)),
          );
        }
      }
    }

    return delivered;
  }
}
