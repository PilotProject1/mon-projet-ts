import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { BackupService } from './backup.service';

/**
 * Déclenchement d'une sauvegarde depuis l'extérieur.
 *
 * Même raison que pour la tournée des rappels : sur une offre d'hébergement
 * où l'instance s'endort, le planificateur interne ne s'exécute pas à l'heure
 * dite. Un appel programmé par un service de cron réveille le serveur *et*
 * déclenche la sauvegarde — c'est le seul moyen d'être sûr qu'elle a lieu.
 *
 * Garder les deux n'est pas une redondance inutile : le planificateur suffit
 * quand l'instance tourne, l'appel externe rattrape quand elle dort.
 */
@Controller('sauvegardes')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly backup: BackupService) {}

  @Post('executer')
  @HttpCode(HttpStatus.OK)
  // Le jeton est le seul rempart : on limite les essais.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async executer(@Headers('x-sauvegardes-token') token?: string) {
    const attendu = process.env.BACKUP_TRIGGER_TOKEN;
    if (!attendu) {
      // Sans jeton configuré, le point d'entrée reste fermé : il ne doit
      // jamais s'ouvrir par simple absence de configuration.
      throw new ServiceUnavailableException(
        "Le déclenchement externe des sauvegardes n'est pas configuré",
      );
    }
    if (!this.correspond(token, attendu)) {
      this.logger.warn(
        'Tentative de déclenchement de sauvegarde avec un jeton invalide',
      );
      throw new ForbiddenException('Jeton invalide');
    }

    const resume = await this.backup.executer();
    this.logger.log(
      `Sauvegarde ${resume.cle} déclenchée de l'extérieur : ${resume.total} ligne(s), ` +
        `${Math.round(resume.octets / 1024)} Kio` +
        (resume.deporte ? '' : ' — attention : dépôt local, non déporté'),
    );
    return resume;
  }

  /** Comparaison à durée constante, pour ne rien révéler du jeton attendu. */
  private correspond(recu: string | undefined, attendu: string): boolean {
    if (!recu) return false;
    const a = Buffer.from(recu);
    const b = Buffer.from(attendu);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
