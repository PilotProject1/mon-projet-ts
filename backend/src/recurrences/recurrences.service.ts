import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import {
  detecterRecurrences,
  hausseNotable,
  type SerieRecurrente,
} from './recurrence.util';

/**
 * Au-delà, on ne remonte pas plus loin : les documents anciens ne changent
 * rien à ce que paie l'utilisateur aujourd'hui.
 */
const MAX_DOCUMENTS = 500;

export interface Recurrences {
  series: SerieRecurrente[];
  /** Séries dont le dernier montant a sensiblement augmenté. */
  hausses: SerieRecurrente[];
  /** Ce que représentent ces dépenses sur douze mois. */
  yearlyTotal: number;
  /**
   * Documents lus dont l'émetteur n'a pas été reconnu. Sans émetteur, une
   * facture ne rejoint aucune série : ce compte dit exactement ce que la
   * lecture n'a pas su faire, et ce que l'utilisateur perd.
   */
  unrecognized: number;
  /**
   * true lorsque le plan donne droit à la lecture par le modèle, qui
   * reconnaît n'importe quel émetteur là où le moteur local s'en tient à une
   * liste. L'écart est réel : autant qu'il soit dit.
   */
  aiReading: boolean;
}

@Injectable()
export class RecurrencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  async forUser(userId: string): Promise<Recurrences> {
    const [documents, unrecognized, plan] = await Promise.all([
      this.prisma.document.findMany({
        where: { userId, provider: { not: null }, amount: { not: null } },
        select: {
          id: true,
          name: true,
          provider: true,
          amount: true,
          documentDate: true,
        },
        orderBy: { documentDate: 'desc' },
        take: MAX_DOCUMENTS,
      }),
      // Lus, mais sans émetteur reconnu : la lecture a bien eu lieu, c'est la
      // reconnaissance qui a échoué. Un document jamais analysé ne compte pas.
      this.prisma.document.count({
        where: { userId, analyzedAt: { not: null }, provider: null },
      }),
      this.plans.getPlan(userId),
    ]);

    const series = detecterRecurrences(documents);
    return {
      series,
      hausses: series.filter(hausseNotable),
      yearlyTotal:
        Math.round(
          series.reduce((s, serie) => s + serie.yearlyTotal, 0) * 100,
        ) / 100,
      unrecognized,
      aiReading: this.plans.hasFeature(plan, 'ia'),
    };
  }
}
