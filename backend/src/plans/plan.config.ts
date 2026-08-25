import { Plan } from '@prisma/client';

/**
 * Fonctionnalités pouvant être réservées à certains plans.
 * - ia          : extraction automatique des documents + recherche en langage naturel
 * - partage     : liens de partage sécurisés
 * - facturation : module entreprise (clients, factures)
 * - equipes     : plusieurs utilisateurs et droits d'accès (non implémenté, voir plus bas)
 */
export type PlanFeature = 'ia' | 'partage' | 'facturation' | 'equipes';

/**
 * Périodicité de facturation.
 *
 * L'annuel n'est pas qu'une réduction : c'est le principal levier de
 * rétention. À l'année, l'abonné ne reconduit qu'une décision au lieu de
 * douze — les mesures du secteur donnent 6,5 à 8 % de résiliation mensuelle
 * en grand public contre 3 à 5 % en professionnel, et l'engagement annuel
 * ramène cette érosion à une seule échéance.
 */
export type BillingInterval = 'mensuel' | 'annuel';

export const BILLING_INTERVALS = ['mensuel', 'annuel'] as const;

export function isBillingInterval(value: string): value is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(value);
}

export interface PlanDefinition {
  label: string;
  /**
   * Prix mensuel en euros. Net de TVA : l'éditeur est en franchise en base
   * (art. 293 B du CGI), aucune taxe ne s'ajoute à l'affichage.
   */
  monthlyPrice: number;
  /**
   * Prix annuel en euros, ou null quand le plan n'est pas vendu à l'année.
   * Fixé à dix mois : deux mois offerts, ce que pratiquent les concurrents
   * directs du segment indépendant.
   */
  yearlyPrice: number | null;
  /** Nombre maximum de documents, ou null pour illimité. */
  maxDocuments: number | null;
  features: PlanFeature[];
}

export const PLANS: Record<Plan, PlanDefinition> = {
  /*
   * Le gratuit donne accès à tout ce que fait le Premium, mais sur dix
   * documents seulement.
   *
   * Un essai qui retire la fonctionnalité principale n'est pas un essai :
   * l'extraction automatique est ce qui distingue ce service d'un dossier
   * partagé, et c'est en la voyant fonctionner sur ses propres papiers qu'on
   * décide de payer. La borne est donc le nombre de documents, jamais ce
   * qu'on peut en faire.
   */
  gratuit: {
    label: 'Gratuit',
    monthlyPrice: 0,
    yearlyPrice: null,
    maxDocuments: 10,
    features: ['ia', 'partage'],
  },
  premium: {
    label: 'Particulier Premium',
    monthlyPrice: 4.99,
    yearlyPrice: 49.9,
    maxDocuments: null,
    features: ['ia', 'partage'],
  },
  pro: {
    label: 'Professionnel',
    monthlyPrice: 19.99,
    yearlyPrice: 199,
    maxDocuments: null,
    features: ['ia', 'partage', 'facturation'],
  },
  pme: {
    label: 'PME',
    monthlyPrice: 49,
    yearlyPrice: null,
    maxDocuments: null,
    // 'equipes' est déclaré ici pour que le plan soit complet, mais le
    // multi-utilisateur n'est pas encore implémenté : chaque compte reste
    // individuel. Aucune route ne dépend aujourd'hui de cette fonctionnalité.
    features: ['ia', 'partage', 'facturation', 'equipes'],
  },
};

/** Libellé lisible d'une fonctionnalité, pour les messages d'erreur. */
export const FEATURE_LABELS: Record<PlanFeature, string> = {
  ia: "L'assistant IA",
  partage: 'Le partage sécurisé de documents',
  facturation: 'Le module de facturation',
  equipes: 'La gestion des équipes',
};

/** Plans donnant accès à une fonctionnalité, du moins cher au plus cher. */
export function plansWithFeature(feature: PlanFeature): Plan[] {
  return (Object.keys(PLANS) as Plan[]).filter((plan) =>
    PLANS[plan].features.includes(feature),
  );
}

/**
 * Plans qu'un utilisateur peut souscrire en ligne.
 *
 * `pme` en est volontairement absent : il annonce le multi-utilisateur et la
 * gestion d'équipes, qui ne sont pas implémentés. Le mettre en vente
 * reviendrait à facturer une fonctionnalité inexistante.
 */
export const PURCHASABLE_PLANS = ['premium', 'pro'] as const;
export type PurchasablePlan = (typeof PURCHASABLE_PLANS)[number];

export function isPurchasablePlan(value: string): value is PurchasablePlan {
  return (PURCHASABLE_PLANS as readonly string[]).includes(value);
}

/**
 * Identifiant de prix Stripe associé à chaque plan payant, renseigné par
 * variable d'environnement pour que les mêmes sources servent en test et en
 * production.
 */
export function stripePriceIdFor(
  plan: PurchasablePlan,
  interval: BillingInterval = 'mensuel',
): string | undefined {
  // Les noms mensuels restent ceux d'origine : les renommer obligerait à
  // reconfigurer l'hébergeur au même instant que le déploiement, et tout
  // paiement passant entre les deux échouerait.
  const byPlan: Record<
    PurchasablePlan,
    Record<BillingInterval, string | undefined>
  > = {
    premium: {
      mensuel: process.env.STRIPE_PRICE_PREMIUM,
      annuel: process.env.STRIPE_PRICE_PREMIUM_ANNUEL,
    },
    pro: {
      mensuel: process.env.STRIPE_PRICE_PRO,
      annuel: process.env.STRIPE_PRICE_PRO_ANNUEL,
    },
  };
  return byPlan[plan][interval];
}

/**
 * Plan correspondant à un identifiant de prix Stripe, pour les webhooks.
 *
 * Les deux périodicités mènent au même plan : un abonné à l'année a
 * exactement les mêmes droits qu'un abonné au mois. Ne reconnaître que le
 * prix mensuel rétrograderait tout abonné annuel au plan gratuit dès la
 * réception de son propre webhook de souscription.
 */
export function planForStripePriceId(priceId: string): PurchasablePlan | null {
  for (const plan of PURCHASABLE_PLANS) {
    for (const interval of BILLING_INTERVALS) {
      if (stripePriceIdFor(plan, interval) === priceId) return plan;
    }
  }
  return null;
}
