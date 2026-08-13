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
  gratuit: {
    label: 'Gratuit',
    monthlyPrice: 0,
    maxDocuments: 50,
    features: [],
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
