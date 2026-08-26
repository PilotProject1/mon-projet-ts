import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import Stripe from 'stripe';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BILLING_INTERVALS,
  PLANS,
  PURCHASABLE_PLANS,
  intervalForStripePriceId,
  planForStripePriceId,
  stripePriceEnvVar,
  stripePriceIdFor,
  type BillingInterval,
  type PurchasablePlan,
} from '../plans/plan.config';

/** Verdict du contrôle d'un tarif configuré. */
export type StatutTarif =
  | 'absent'
  | 'conforme'
  | 'introuvable'
  | 'inactif'
  | 'incoherent';

export interface ControleTarif {
  plan: PurchasablePlan;
  interval: BillingInterval;
  variable: string;
  statut: StatutTarif;
  detail?: string;
}

/**
 * Distingue « ce tarif n'existe pas » de tout autre échec Stripe (clé
 * refusée, réseau, panne). La confusion ferait passer une panne passagère
 * pour une erreur de configuration, et enverrait chercher au mauvais
 * endroit.
 */
function estTarifInexistant(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'resource_missing'
  );
}

/**
 * Page de paiement à présenter au client quand la facture émise n'a pas pu
 * être réglée seule.
 *
 * Le cas ordinaire est muet : la carte enregistrée est débitée et il n'y a
 * rien à faire. Il ne reste une page à ouvrir que si la banque demande une
 * authentification, ou si le paiement a échoué — précisément les moments où
 * laisser le client sans rien afficher lui ferait croire que tout est réglé.
 */
function paiementAFinir(abonnement: Stripe.Subscription): string | null {
  const facture = abonnement.latest_invoice;
  if (!facture || typeof facture === 'string') return null;
  if (facture.status === 'paid' || facture.status === 'void') return null;
  return facture.hosted_invoice_url ?? null;
}

/** Périodicité Stripe attendue pour chacune de nos périodicités. */
const INTERVALLE_STRIPE: Record<BillingInterval, 'month' | 'year'> = {
  mensuel: 'month',
  annuel: 'year',
};

@Injectable()
export class BillingService implements OnApplicationBootstrap {
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
    interval: BillingInterval = 'mensuel',
  ): Promise<{ url: string }> {
    const priceId = stripePriceIdFor(plan, interval);
    if (!priceId) {
      throw new ServiceUnavailableException(
        `Aucun tarif Stripe n'est configuré pour le plan ${plan} en ${interval}`,
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
      subscription_data: { metadata: { userId, plan, interval } },
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

  /**
   * Abonnement Stripe en cours pour un compte, ou null.
   *
   * Relu chez Stripe et non en base : entre deux webhooks, seule la réponse
   * de Stripe dit l'état réel de l'abonnement qu'on s'apprête à modifier.
   */
  private async abonnementEnCours(
    userId: string,
  ): Promise<Stripe.Subscription> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeSubscriptionId) {
      throw new BadRequestException(
        "Aucun abonnement en cours n'est rattaché à ce compte",
      );
    }
    return this.appelStripe(() =>
      this.stripe.subscriptions.retrieve(user.stripeSubscriptionId!),
    );
  }

  /**
   * Exécute un appel Stripe en traduisant ses pannes en indisponibilité.
   *
   * Sans cela, une clé refusée ou un réseau coupé remonte en « erreur interne
   * du serveur » : l'abonné croit à un bogue de l'application et abandonne,
   * alors qu'il suffisait de réessayer.
   */
  private async appelStripe<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      this.logger.error(
        `Appel Stripe en échec : ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        "Le service de paiement est momentanément indisponible. Votre abonnement n'a pas été modifié : réessayez dans un moment.",
      );
    }
  }

  /**
   * Annule une résiliation programmée : l'abonnement reprend son cours.
   *
   * Tant qu'il court encore, revenir sur sa décision doit se faire d'un
   * geste. Sans cela, le seul chemin praticable est d'attendre la fin de la
   * période puis de tout re-souscrire — c'est-à-dire, en pratique, de partir.
   */
  async reprendreAbonnement(userId: string): Promise<{ repris: boolean }> {
    const abonnement = await this.abonnementEnCours(userId);
    if (!abonnement.cancel_at_period_end) {
      // Déjà en cours : le dire plutôt que d'échouer, l'utilisateur ayant
      // obtenu ce qu'il demandait.
      return { repris: false };
    }

    const misAJour = await this.appelStripe(() =>
      this.stripe.subscriptions.update(abonnement.id, {
        cancel_at_period_end: false,
      }),
    );
    await this.syncSubscription(misAJour);
    this.logger.log(`Abonnement ${abonnement.id} repris par le compte ${userId}`);
    return { repris: true };
  }

  /**
   * Change l'offre ou la périodicité d'un abonnement en cours.
   *
   * Passe par l'API plutôt que par le portail Stripe : le portail dépend
   * d'une configuration propre à chaque mode (test et production en ont
   * chacun une), et refuse de changer d'offre un abonnement dont la
   * résiliation est programmée. Le client se retrouvait alors sans aucun
   * chemin pour changer d'offre depuis l'application.
   *
   * Une résiliation programmée est levée au passage : demander une autre
   * offre, c'est vouloir rester.
   */
  async changerOffre(
    userId: string,
    plan: PurchasablePlan,
    interval: BillingInterval = 'mensuel',
  ): Promise<{ change: boolean; paiementUrl?: string }> {
    const priceId = stripePriceIdFor(plan, interval);
    if (!priceId) {
      throw new ServiceUnavailableException(
        `Aucun tarif Stripe n'est configuré pour le plan ${plan} en ${interval}`,
      );
    }

    const abonnement = await this.abonnementEnCours(userId);
    const item = abonnement.items.data[0];
    if (!item) {
      throw new BadRequestException(
        "L'abonnement en cours ne comporte aucune ligne de facturation",
      );
    }

    if (item.price.id === priceId && !abonnement.cancel_at_period_end) {
      return { change: false };
    }

    const misAJour = await this.appelStripe(() =>
      this.stripe.subscriptions.update(abonnement.id, {
        items: [{ id: item.id, price: priceId }],
        cancel_at_period_end: false,
        /*
         * Facturé sur-le-champ, et non reporté à l'échéance suivante.
         *
         * Les CGV annoncent un prélèvement « d'avance et pour la période
         * entière » : reporter l'écart aurait donné douze mois d'accès annuel
         * avant le moindre paiement. Le temps déjà réglé reste décompté — le
         * client ne paie que la différence.
         */
        proration_behavior: 'always_invoice',
        metadata: { ...abonnement.metadata, userId, plan, interval },
        expand: ['latest_invoice'],
      }),
    );

    // Même fonction que pour les webhooks, sur l'objet que Stripe vient de
    // renvoyer : ce n'est pas la redirection de retour, qu'un visiteur peut
    // atteindre sans avoir payé, mais la réponse à un appel serveur à serveur.
    // Le webhook rejouera le même état, sans effet supplémentaire.
    await this.syncSubscription(misAJour);
    this.logger.log(
      `Abonnement ${abonnement.id} : compte ${userId} passé au tarif ${plan} ${interval}`,
    );
    return { change: true, paiementUrl: paiementAFinir(misAJour) ?? undefined };
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

    // Relue du tarif effectivement facturé : c'est elle qui détermine si
    // l'avis de reconduction annuelle est dû.
    const interval =
      grantsAccess && priceId ? intervalForStripePriceId(priceId) : null;

    const periodEnd = item?.current_period_end;
    const renewsAt =
      grantsAccess && periodEnd ? new Date(periodEnd * 1000) : null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: grantsAccess ? subscription.id : null,
        planRenewsAt: renewsAt,
        planInterval: interval,
        planCancelAtPeriodEnd: grantsAccess
          ? Boolean(subscription.cancel_at_period_end)
          : false,
        // L'avis vaut pour une échéance précise : dès qu'elle change, il
        // redevient dû pour la suivante.
        ...(renewsAt === null ? { renewalNoticeSentFor: null } : {}),
      },
    });

    this.logger.log(
      `Abonnement ${subscription.id} (${subscription.status}) : compte ${user.id} passé en plan ${plan}`,
    );
  }

  /**
   * Contrôle des tarifs configurés, au démarrage.
   *
   * Une erreur de configuration Stripe ne se voit pas : un identifiant de
   * prix collé dans la mauvaise variable reste un identifiant valide, et le
   * paiement aboutit — au mauvais montant, ou pour la mauvaise durée. Le
   * client, lui, découvre l'écart sur son relevé.
   *
   * Ce contrôle ne bloque jamais le démarrage : une panne Stripe au
   * lancement empêcherait l'application de servir des pages qui n'ont rien à
   * voir avec le paiement.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.available) return;
    try {
      const controles = await this.verifierTarifs();
      for (const c of controles) {
        if (c.statut === 'conforme') continue;
        const message = `Tarif ${c.plan} ${c.interval} (${c.variable}) : ${c.detail ?? c.statut}`;
        // Un tarif absent est un choix possible — l'offre n'est simplement
        // pas proposée. Un tarif présent mais faux est une anomalie.
        if (c.statut === 'absent') this.logger.warn(message);
        else this.logger.error(message);
      }
    } catch (error) {
      this.logger.warn(
        `Contrôle des tarifs Stripe impossible au démarrage : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Compare chaque tarif configuré à ce que Stripe en dit : existence,
   * activité, devise, périodicité et montant. Le catalogue du code fait foi —
   * c'est lui qui est affiché au client et repris dans les CGV.
   */
  async verifierTarifs(): Promise<ControleTarif[]> {
    const controles: ControleTarif[] = [];

    for (const plan of PURCHASABLE_PLANS) {
      for (const interval of BILLING_INTERVALS) {
        const variable = stripePriceEnvVar(plan, interval);
        const priceId = stripePriceIdFor(plan, interval);
        const attenduEuros =
          interval === 'annuel'
            ? PLANS[plan].yearlyPrice
            : PLANS[plan].monthlyPrice;

        if (!priceId) {
          // Sans prix annuel, la formule n'est pas vendue : ce n'est une
          // anomalie que si le catalogue, lui, l'annonce.
          controles.push({
            plan,
            interval,
            variable,
            statut: 'absent',
            detail:
              attenduEuros !== null
                ? `le catalogue annonce ${attenduEuros} €, mais aucun identifiant n'est configuré : la formule ne peut pas être souscrite`
                : 'aucun identifiant configuré',
          });
          continue;
        }

        // Seul « ce tarif n'existe pas » est un verdict. Une clé refusée ou
        // un réseau coupé ne dit rien des tarifs : on laisse remonter, pour
        // ne pas accuser une configuration correcte.
        const price = await this.stripe.prices
          .retrieve(priceId)
          .catch((error: unknown) => {
            if (estTarifInexistant(error)) return null;
            throw error;
          });

        if (!price) {
          controles.push({
            plan,
            interval,
            variable,
            statut: 'introuvable',
            detail: `identifiant ${priceId} inconnu de ce compte Stripe (clé de test et clé de production ne partagent pas leurs tarifs)`,
          });
          continue;
        }

        const ecarts: string[] = [];
        const attendu = INTERVALLE_STRIPE[interval];
        if (price.recurring?.interval !== attendu) {
          ecarts.push(
            `périodicité ${price.recurring?.interval ?? 'ponctuelle'} au lieu de ${attendu}`,
          );
        }
        if (price.currency !== 'eur') {
          ecarts.push(`devise ${price.currency} au lieu de eur`);
        }
        if (attenduEuros !== null) {
          const centimes = Math.round(attenduEuros * 100);
          if (price.unit_amount !== centimes) {
            ecarts.push(
              `montant ${(price.unit_amount ?? 0) / 100} € au lieu de ${attenduEuros} €`,
            );
          }
        }

        if (!price.active) {
          controles.push({
            plan,
            interval,
            variable,
            statut: 'inactif',
            detail: `le tarif ${priceId} est archivé chez Stripe`,
          });
          continue;
        }

        controles.push({
          plan,
          interval,
          variable,
          statut: ecarts.length ? 'incoherent' : 'conforme',
          detail: ecarts.length ? ecarts.join(', ') : undefined,
        });
      }
    }

    return controles;
  }
}
