import { Plan } from '@prisma/client';

/**
 * Fonctionnalités pouvant être réservées à certains plans.
 * - ia          : extraction automatique des documents + recherche en langage naturel
 * - partage     : liens de partage sécurisés
 * - facturation : module entreprise (clients, factures)
 * - equipes     : plusieurs utilisateurs et droits d'accès (non implémenté, voir plus bas)
 */
export type PlanFeature = 'ia' | 'partage' | 'facturation' | 'equipes';

export interface PlanDefinition {
  label: string;
  /** Prix mensuel TTC en euros, à titre indicatif pour l'affichage. */
  monthlyPrice: number;
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
    maxDocuments: 10,
    features: ['ia', 'partage'],
  },
  premium: {
    label: 'Particulier Premium',
    monthlyPrice: 4.99,
    maxDocuments: null,
    features: ['ia', 'partage'],
  },
  pro: {
    label: 'Professionnel',
    monthlyPrice: 19.99,
    maxDocuments: null,
    features: ['ia', 'partage', 'facturation'],
  },
  pme: {
    label: 'PME',
    monthlyPrice: 49,
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
export function stripePriceIdFor(plan: PurchasablePlan): string | undefined {
  const byPlan: Record<PurchasablePlan, string | undefined> = {
    premium: process.env.STRIPE_PRICE_PREMIUM,
    pro: process.env.STRIPE_PRICE_PRO,
  };
  return byPlan[plan];
}

/** Plan correspondant à un identifiant de prix Stripe, pour les webhooks. */
export function planForStripePriceId(priceId: string): PurchasablePlan | null {
  return (
    PURCHASABLE_PLANS.find((plan) => stripePriceIdFor(plan) === priceId) ?? null
  );
}
