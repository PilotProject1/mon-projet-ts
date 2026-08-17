import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  planForStripePriceId,
  stripePriceIdFor,
  type PurchasablePlan,
} from '../plans/plan.config';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private client: Stripe | null = null;

  constructor(private readonly prisma: PrismaService) {}

  get available(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  private get stripe(): Stripe {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new ServiceUnavailableException(
        "Le paiement n'est pas configuré (STRIPE_SECRET_KEY manquant)",
      );
    }
    this.client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
    return this.client;
  }

  private get frontendUrl(): string {
    // FRONTEND_ORIGIN peut contenir plusieurs origines séparées par des
    // virgules : la première sert de base aux redirections de retour.
    const first = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');
    return first;
  }

  /**
   * Retrouve ou crée le client Stripe correspondant à un utilisateur, de sorte
   * qu'un même compte ne génère jamais deux clients distincts.
   */
  private async resolveCustomerId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  /** Session de paiement hébergée par Stripe pour souscrire à un plan. */
  async createCheckoutSession(
    userId: string,
    plan: PurchasablePlan,
  ): Promise<{ url: string }> {
    const priceId = stripePriceIdFor(plan);
    if (!priceId) {
      throw new ServiceUnavailableException(
        `Aucun tarif Stripe n'est configuré pour le plan ${plan}`,
      );
    }

    const customerId = await this.resolveCustomerId(userId);

    const params = {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Rattache la session au compte : le webhook s'en sert pour retrouver
      // l'utilisateur même si le client Stripe venait à changer.
      client_reference_id: userId,
      subscription_data: { metadata: { userId, plan } },
      success_url: `${this.frontendUrl}/abonnement?paiement=succes`,
      cancel_url: `${this.frontendUrl}/abonnement?paiement=annule`,
    } satisfies Stripe.Checkout.SessionCreateParams;

    // Managed Payments est actif par défaut sur certains comptes : Stripe s'y
    // substitue alors au vendeur et ajoute la TVA. Incompatible avec la
    // franchise en base (art. 293 B), qui suppose des prix nets et un vendeur
    // unique — celui désigné par les CGV.
    const session = await this.stripe.checkout.sessions.create({
      ...params,
      managed_payments: { enabled: false },
    });

    if (!session.url) {
      throw new ServiceUnavailableException(
        "Stripe n'a pas renvoyé d'URL de paiement",
      );
    }
    return { url: session.url };
  }

  /**
   * Met fin immédiatement à l'abonnement d'un compte sur le point d'être
   * supprimé.
   *
   * Appelée avant la suppression, et non après : un compte effacé dont
   * l'abonnement courrait encore continuerait d'être prélevé, sans que
   * personne puisse plus l'arrêter depuis l'application.
   *
   * Lève si l'annulation échoue. Refuser la suppression est préférable à la
   * mener en laissant un prélèvement mensuel derrière soi.
   */
  async annulerAbonnementAvantSuppression(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeSubscriptionId) return;

    try {
      await this.stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch (error) {
      // Un abonnement déjà résilié chez Stripe n'est pas une erreur : il n'y
      // a simplement plus rien à annuler.
      const message = error instanceof Error ? error.message : String(error);
      if (
        !/No such subscription|resource_missing|already canceled/i.test(message)
      ) {
        throw new ServiceUnavailableException(
          "L'abonnement n'a pas pu être résilié : la suppression est interrompue " +
            'pour éviter un prélèvement sans compte. Réessayez dans un moment.',
        );
      }
    }
  }

  /** Portail Stripe : changement de moyen de paiement, factures, résiliation. */
  async createPortalSession(userId: string): Promise<{ url: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      throw new BadRequestException(
        "Aucun abonnement n'est rattaché à ce compte",
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      // Le portail étant hébergé par Stripe, c'est au retour que l'application
      // peut confirmer la modification et relire le plan : le paramètre sert
      // de signal, l'état réel venant toujours du webhook.
      return_url: `${this.frontendUrl}/abonnement?retour=portail`,
    });
    return { url: session.url };
  }

  /**
   * Vérifie la signature d'un webhook. La vérification exige le corps brut :
   * toute réécriture par un parseur JSON invaliderait la signature.
   */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('STRIPE_WEBHOOK_SECRET manquant');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  /**
   * Applique un événement Stripe au compte concerné.
   *
   * C'est ici, et nulle part ailleurs, que le plan d'un utilisateur change :
   * la redirection de retour après paiement n'est qu'un affichage, un
   * utilisateur pouvant l'atteindre sans avoir payé.
   */
  async applyEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') return;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) return;
        const subscription =
          await this.stripe.subscriptions.retrieve(subscriptionId);
        await this.syncSubscription(subscription);
        return;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await this.syncSubscription(event.data.object);
        return;
      }

      default:
        // Les autres événements ne modifient pas les droits d'accès.
        return;
    }
  }

  /**
   * Aligne le plan de l'utilisateur sur l'état réel de son abonnement Stripe.
   * Idempotent : rejouer le même événement produit le même résultat.
   */
  private async syncSubscription(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { stripeCustomerId: customerId },
          { id: subscription.metadata?.userId ?? '__inconnu__' },
        ],
      },
    });
    if (!user) {
      this.logger.warn(
        `Abonnement ${subscription.id} reçu pour un client Stripe inconnu (${customerId})`,
      );
      return;
    }

    // Un abonnement actif ou en période d'essai ouvre les droits ; tout autre
    // état (impayé, résilié, incomplet) ramène au plan gratuit.
    const grantsAccess =
      subscription.status === 'active' || subscription.status === 'trialing';

    const item = subscription.items.data[0];
    const priceId = item?.price?.id;
    const planFromPrice = priceId ? planForStripePriceId(priceId) : null;

    const plan: Plan =
      grantsAccess && planFromPrice ? planFromPrice : 'gratuit';

    const periodEnd = item?.current_period_end;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: grantsAccess ? subscription.id : null,
        planRenewsAt:
          grantsAccess && periodEnd ? new Date(periodEnd * 1000) : null,
        planCancelAtPeriodEnd: grantsAccess
          ? Boolean(subscription.cancel_at_period_end)
          : false,
      },
    });

    this.logger.log(
      `Abonnement ${subscription.id} (${subscription.status}) : compte ${user.id} passé en plan ${plan}`,
    );
  }
}
