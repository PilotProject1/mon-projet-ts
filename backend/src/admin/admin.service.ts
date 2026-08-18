import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Jours d'historique repris dans la courbe des inscriptions. */
const JOURS_HISTORIQUE = 14;

export interface StatistiquesAdmin {
  comptes: {
    total: number;
    aujourdhui: number;
    septDerniersJours: number;
  };
  /** Répartition des comptes par offre. */
  plans: Record<string, number>;
  documents: {
    total: number;
    aujourdhui: number;
    /** Documents dont la lecture a abouti au moins une fois. */
    analyses: number;
  };
  echeances: {
    total: number;
    aFaire: number;
  };
  /** Inscriptions jour par jour, du plus ancien au plus récent. */
  inscriptionsParJour: { jour: string; nombre: number }[];
}

/**
 * Chiffres de suivi du service.
 *
 * Volontairement des compteurs, et rien d'autre : aucune adresse, aucun nom,
 * aucun titre de document. L'éditeur y a droit comme responsable de
 * traitement, mais un écran qui déballe les données de ses clients est
 * exactement ce que la politique de confidentialité promet de ne pas faire.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Minuit à Paris, exprimé en instant absolu. */
  private static minuitParis(decalageJours = 0): Date {
    const maintenant = new Date();
    const partiesParis = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(maintenant);
    const minuit = new Date(`${partiesParis}T00:00:00+02:00`);
    minuit.setUTCDate(minuit.getUTCDate() - decalageJours);
    return minuit;
  }

  async statistiques(): Promise<StatistiquesAdmin> {
    const debutDuJour = AdminService.minuitParis();
    const debutSemaine = AdminService.minuitParis(7);
    const debutHistorique = AdminService.minuitParis(JOURS_HISTORIQUE - 1);

    const [
      comptesTotal,
      comptesAujourdhui,
      comptesSemaine,
      parPlan,
      documentsTotal,
      documentsAujourdhui,
      documentsAnalyses,
      echeancesTotal,
      echeancesAFaire,
      inscriptionsRecentes,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: debutDuJour } } }),
      this.prisma.user.count({ where: { createdAt: { gte: debutSemaine } } }),
      this.prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
      this.prisma.document.count(),
      this.prisma.document.count({
        where: { createdAt: { gte: debutDuJour } },
      }),
      this.prisma.document.count({ where: { analyzedAt: { not: null } } }),
      this.prisma.deadline.count(),
      this.prisma.deadline.count({ where: { status: 'a_faire' } }),
      // Les dates sont regroupées ici plutôt qu'en SQL : Prisma ne sait pas
      // grouper sur une partie de date sans requête brute, et le volume de
      // deux semaines d'inscriptions ne justifie pas d'en écrire une.
      this.prisma.user.findMany({
        where: { createdAt: { gte: debutHistorique } },
        select: { createdAt: true },
      }),
    ]);

    const plans: Record<string, number> = {};
    for (const ligne of parPlan) plans[ligne.plan] = ligne._count._all;

    const parJour = new Map<string, number>();
    for (let recul = JOURS_HISTORIQUE - 1; recul >= 0; recul--) {
      parJour.set(AdminService.jourParis(AdminService.minuitParis(recul)), 0);
    }
    for (const { createdAt } of inscriptionsRecentes) {
      const jour = AdminService.jourParis(createdAt);
      if (parJour.has(jour)) parJour.set(jour, (parJour.get(jour) ?? 0) + 1);
    }

    return {
      comptes: {
        total: comptesTotal,
        aujourdhui: comptesAujourdhui,
        septDerniersJours: comptesSemaine,
      },
      plans,
      documents: {
        total: documentsTotal,
        aujourdhui: documentsAujourdhui,
        analyses: documentsAnalyses,
      },
      echeances: { total: echeancesTotal, aFaire: echeancesAFaire },
      inscriptionsParJour: [...parJour].map(([jour, nombre]) => ({
        jour,
        nombre,
      })),
    };
  }

  /** Jour civil parisien d'un instant, au format AAAA-MM-JJ. */
  private static jourParis(date: Date): string {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}
