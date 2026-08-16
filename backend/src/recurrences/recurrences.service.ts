import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
}

@Injectable()
export class RecurrencesService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string): Promise<Recurrences> {
    const documents = await this.prisma.document.findMany({
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
    });

    const series = detecterRecurrences(documents);
    return {
      series,
      hausses: series.filter(hausseNotable),
      yearlyTotal:
        Math.round(
          series.reduce((s, serie) => s + serie.yearlyTotal, 0) * 100,
        ) / 100,
    };
  }
}
