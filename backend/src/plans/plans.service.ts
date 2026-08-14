import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FEATURE_LABELS,
  PLANS,
  plansWithFeature,
  type PlanFeature,
} from './plan.config';

export interface PlanUsage {
  plan: Plan;
  label: string;
  monthlyPrice: number;
  features: PlanFeature[];
  documents: {
    used: number;
    max: number | null;
    remaining: number | null;
  };
  /** Échéance de l'abonnement, null sur le plan gratuit. */
  renewsAt: string | null;
  /** true si l'abonnement se termine à cette date au lieu d'être reconduit. */
  endsAtPeriodEnd: boolean;
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlan(userId: string): Promise<Plan> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user.plan;
  }

  async getUsage(userId: string): Promise<PlanUsage> {
    const [user, documentCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, planRenewsAt: true, planCancelAtPeriodEnd: true },
      }),
      this.prisma.document.count({ where: { userId } }),
    ]);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const plan = user.plan;
    const definition = PLANS[plan];
    return {
      plan,
      label: definition.label,
      monthlyPrice: definition.monthlyPrice,
      features: definition.features,
      documents: {
        used: documentCount,
        max: definition.maxDocuments,
        remaining:
          definition.maxDocuments === null
            ? null
            : Math.max(definition.maxDocuments - documentCount, 0),
      },
      renewsAt: user.planRenewsAt?.toISOString() ?? null,
      endsAtPeriodEnd: user.planCancelAtPeriodEnd,
    };
  }

  hasFeature(plan: Plan, feature: PlanFeature): boolean {
    return PLANS[plan].features.includes(feature);
  }

  /**
   * Vérifie qu'un document supplémentaire peut être ajouté.
   * Appelé avant l'écriture en base et avant l'envoi du fichier au stockage.
   */
  async assertCanAddDocument(userId: string): Promise<void> {
    const plan = await this.getPlan(userId);
    const max = PLANS[plan].maxDocuments;
    if (max === null) {
      return;
    }

    const used = await this.prisma.document.count({ where: { userId } });
    if (used >= max) {
      throw new ForbiddenException(
        `Votre plan ${PLANS[plan].label} est limité à ${max} documents (${used} utilisés). ` +
          'Passez à un plan supérieur pour en ajouter davantage.',
      );
    }
  }

  async assertFeature(userId: string, feature: PlanFeature): Promise<void> {
    const plan = await this.getPlan(userId);
    if (this.hasFeature(plan, feature)) {
      return;
    }

    const required = plansWithFeature(feature).map((p) => PLANS[p].label);
    throw new ForbiddenException(
      `${FEATURE_LABELS[feature]} n'est pas inclus dans votre plan ${PLANS[plan].label}. ` +
        `Disponible avec : ${required.join(', ')}.`,
    );
  }
}
