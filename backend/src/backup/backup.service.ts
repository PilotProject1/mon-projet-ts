import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { gzipSync, gunzipSync } from 'zlib';
import { PrismaService } from '../prisma/prisma.service';
import { BackupDepot } from './backup-depot';
import { chiffrer, dechiffrer, chiffrementDisponible } from './backup-crypto';

/*
 * Sauvegardes autonomes de la base.
 *
 * Jusqu'ici, la seule protection réelle était la fenêtre de restauration de
 * six heures de l'hébergeur. Six heures suffisent à rattraper une fausse
 * manœuvre remarquée aussitôt ; elles ne suffisent pas à rattraper une
 * suppression découverte le lendemain matin. C'est ce trou-là que ce service
 * comble.
 *
 * Pourquoi pas `pg_dump`. Le script existant l'utilise, et convient très bien
 * depuis un poste de travail. En production il supposerait que le binaire
 * soit présent sur l'instance et que sa version s'accorde à celle du serveur
 * de base — deux conditions qu'on ne découvre pas remplies le jour où l'on
 * restaure, mais rompues. La sauvegarde est donc logique : les lignes sont
 * lues par l'application elle-même et écrites en JSON. Le schéma, lui, vit
 * dans les migrations, en dépôt, sous contrôle de version.
 *
 * Ce que la sauvegarde ne contient pas : les fichiers déposés par les
 * utilisateurs. Ils vivent chez le prestataire de stockage, avec sa propre
 * durabilité, et les recopier ailleurs à chaque tournée coûterait sans
 * commune mesure avec ce que cela protège. La sauvegarde conserve en revanche
 * leurs métadonnées et le texte qui en a été lu.
 */

/** Ordre de lecture, et surtout de réinsertion : les parents avant les enfants. */
const TABLES = [
  'User',
  'Document',
  'Deadline',
  'Contract',
  'ShareLink',
  'ShareLinkAccess',
  'Company',
  'Client',
  'Invoice',
  'Notification',
  'PushSubscription',
  'TwoFactorRecoveryCode',
] as const;

type Table = (typeof TABLES)[number];

/** Nom du modèle Prisma correspondant, en tête minuscule. */
function modele(table: Table): string {
  return table.charAt(0).toLowerCase() + table.slice(1);
}

/*
 * Combien de sauvegardes garder, c'est-à-dire combien de jours.
 *
 * Deux exigences tirent en sens contraire. Plus on garde, mieux on rattrape
 * un incident découvert tardivement. Mais une sauvegarde est aussi une copie
 * de données que des gens ont demandé d'effacer : la politique de
 * confidentialité promet une suppression définitive, et chaque jour
 * supplémentaire allonge le délai avant que ce soit vrai.
 *
 * Quatorze jours : de quoi couvrir un incident qui traîne une semaine sans
 * conserver un mois de données que leurs propriétaires croient parties.
 */
const A_CONSERVER = 14;
const VERSION_FORMAT = 1;

export interface ContenuSauvegarde {
  version: number;
  creeeLe: string;
  tables: Record<string, unknown[]>;
}

export interface ResumeSauvegarde {
  cle: string;
  lignes: Record<string, number>;
  total: number;
  octets: number;
  deporte: boolean;
  anciennesSupprimees: number;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly depot: BackupDepot,
  ) {}

  configuree(): boolean {
    return chiffrementDisponible();
  }

  @Cron('0 3 * * *', { name: 'sauvegarde-base', timeZone: 'Europe/Paris' })
  async executerPlanifiee(): Promise<void> {
    if (!this.configuree()) {
      // Silence volontaire : sans clé, ce n'est pas une panne, c'est une
      // fonctionnalité non configurée. Le point d'entrée externe, lui, le dit.
      return;
    }
    try {
      const resume = await this.executer();
      this.logger.log(
        `Sauvegarde ${resume.cle} : ${resume.total} ligne(s), ` +
          `${Math.round(resume.octets / 1024)} Kio`,
      );
    } catch (err) {
      this.logger.error(
        `Sauvegarde planifiée en échec : ${(err as Error).message}`,
      );
    }
  }

  async executer(): Promise<ResumeSauvegarde> {
    if (!this.configuree()) {
      throw new ServiceUnavailableException(
        'Les sauvegardes ne sont pas configurées sur ce serveur',
      );
    }

    const tables: Record<string, unknown[]> = {};
    const lignes: Record<string, number> = {};
    let total = 0;

    for (const table of TABLES) {
      const client = this.prisma as unknown as Record<
        string,
        { findMany: (a?: unknown) => Promise<unknown[]> }
      >;
      const rangees = await client[modele(table)].findMany({
        orderBy: { id: 'asc' },
      });
      tables[table] = rangees;
      lignes[table] = rangees.length;
      total += rangees.length;
    }

    const contenu: ContenuSauvegarde = {
      version: VERSION_FORMAT,
      creeeLe: new Date().toISOString(),
      tables,
    };

    // Comprimer puis chiffrer, et pas l'inverse : un contenu chiffré ne se
    // comprime plus, l'ordre inverse ferait perdre tout le bénéfice.
    const enveloppe = chiffrer(gzipSync(Buffer.from(JSON.stringify(contenu))));

    const cle = `syneco-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.syneco`;
    await this.depot.deposer(cle, enveloppe);

    await this.verifier(cle, total);
    const anciennesSupprimees = await this.elaguer();

    return {
      cle,
      lignes,
      total,
      octets: enveloppe.length,
      deporte: this.depot.deporte,
      anciennesSupprimees,
    };
  }

  /**
   * Relit ce qui vient d'être écrit, le déchiffre et recompte les lignes.
   *
   * Sans cette étape, on ne saurait qu'au moment de restaurer si la sauvegarde
   * vaut quelque chose — c'est-à-dire au pire moment possible. Une sauvegarde
   * qu'on n'a jamais relue n'est pas une sauvegarde, c'est une intention.
   */
  private async verifier(cle: string, totalAttendu: number): Promise<void> {
    const relu = await this.depot.relire(cle);
    const contenu = JSON.parse(
      gunzipSync(dechiffrer(relu)).toString('utf8'),
    ) as ContenuSauvegarde;

    const total = Object.values(contenu.tables).reduce(
      (somme, rangees) => somme + rangees.length,
      0,
    );
    if (total !== totalAttendu) {
      throw new Error(
        `Sauvegarde ${cle} incohérente : ${total} ligne(s) relue(s) pour ${totalAttendu} écrite(s)`,
      );
    }
  }

  /** Ne garde que les plus récentes : une sauvegarde vieille d'un mois ne sert plus. */
  private async elaguer(): Promise<number> {
    const objets = await this.depot.lister();
    const aSupprimer = objets.slice(
      0,
      Math.max(0, objets.length - A_CONSERVER),
    );
    for (const objet of aSupprimer) {
      await this.depot.supprimer(objet.cle);
    }
    return aSupprimer.length;
  }

  /** Ce que la page de suivi affiche : y a-t-il une sauvegarde récente ? */
  async etat() {
    if (!this.configuree()) {
      return { configuree: false, deporte: false, nombre: 0, derniere: null };
    }
    const objets = await this.depot.lister();
    return {
      configuree: true,
      deporte: this.depot.deporte,
      emplacement: this.depot.emplacement,
      nombre: objets.length,
      derniere: objets.length > 0 ? objets[objets.length - 1].cle : null,
    };
  }
}
