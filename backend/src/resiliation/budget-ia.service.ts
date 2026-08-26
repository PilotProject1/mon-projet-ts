import { Injectable, Logger } from '@nestjs/common';

/** Nombre d'appels IA quotidiens accordés à l'outil public, par défaut. */
const DEFAUT_MAX_PAR_JOUR = 200;

/**
 * Plafond de dépense de l'outil public de résiliation.
 *
 * L'outil est ouvert sans compte : chaque usage déclenche un appel facturé au
 * modèle, et rien n'empêche a priori quelqu'un de le solliciter en boucle. Le
 * plafond borne la facture d'une journée.
 *
 * Le dépassement ne coupe pas le service : la lecture retombe sur le moteur
 * heuristique local et la lettre sur un gabarit, tous deux gratuits. L'outil
 * rend alors un résultat moins fin, mais il rend un résultat — un visiteur
 * arrivé depuis une recherche n'a pas à payer le prix de l'affluence.
 *
 * Le compteur vit en mémoire : un redémarrage le remet à zéro. C'est assumé
 * pour l'instant — il borne la dépense d'une instance entre deux
 * redémarrages, et la limitation par adresse IP couvre l'abus courant. Le
 * jour où le trafic le justifiera, il faudra le persister.
 */
@Injectable()
export class BudgetIaService {
  private readonly logger = new Logger(BudgetIaService.name);
  private jour = BudgetIaService.aujourdhui();
  private consommes = 0;
  private alerteEmise = false;

  private static aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private get maxParJour(): number {
    const brut = Number(process.env.RESILIATION_IA_MAX_PAR_JOUR);
    return Number.isFinite(brut) && brut >= 0 ? brut : DEFAUT_MAX_PAR_JOUR;
  }

  /**
   * Réserve un appel si le plafond du jour le permet.
   * Renvoie false quand il est atteint : à l'appelant de se replier.
   */
  reserver(): boolean {
    const jour = BudgetIaService.aujourdhui();
    if (jour !== this.jour) {
      this.jour = jour;
      this.consommes = 0;
      this.alerteEmise = false;
    }

    if (this.consommes >= this.maxParJour) {
      if (!this.alerteEmise) {
        this.logger.warn(
          `Plafond IA de l'outil public atteint (${this.maxParJour}/jour) : ` +
            'repli sur le moteur heuristique jusqu’à demain.',
        );
        this.alerteEmise = true;
      }
      return false;
    }

    this.consommes += 1;
    return true;
  }

  /** État courant, pour la supervision. */
  etat(): { jour: string; consommes: number; max: number } {
    return { jour: this.jour, consommes: this.consommes, max: this.maxParJour };
  }
}
