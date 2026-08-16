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
import { RemindersService } from './reminders.service';
import { WeeklyDigestService } from '../briefing/weekly-digest.service';

/**
 * Déclenchement de la tournée des rappels depuis l'extérieur.
 *
 * Sur une offre d'hébergement gratuite, l'instance s'endort après quelques
 * minutes sans trafic : le planificateur interne ne s'exécute alors pas à
 * l'heure dite. Un appel programmé par un service de cron gratuit réveille le
 * serveur *et* déclenche la tournée dans le même mouvement, ce qui évite aussi
 * bien de payer que de maintenir l'instance éveillée toute la journée.
 *
 * La tournée reste idempotente : que ce soit ce point d'entrée, le
 * planificateur interne ou les deux qui l'exécutent, un palier ne donne lieu
 * qu'à un seul rappel.
 */
@Controller('rappels')
export class RemindersController {
  private readonly logger = new Logger(RemindersController.name);

  constructor(
    private readonly reminders: RemindersService,
    private readonly digest: WeeklyDigestService,
  ) {}

  @Post('executer')
  @HttpCode(HttpStatus.OK)
  // Le jeton est le seul rempart : on limite les essais.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async run(@Headers('x-rappels-token') token?: string) {
    const expected = process.env.REMINDERS_TRIGGER_TOKEN;
    if (!expected) {
      // Sans jeton configuré, le point d'entrée reste fermé : il ne doit
      // jamais s'ouvrir par simple absence de configuration.
      throw new ServiceUnavailableException(
        "Le déclenchement externe des rappels n'est pas configuré",
      );
    }
    if (!this.matches(token, expected)) {
      this.logger.warn(
        'Tentative de déclenchement des rappels avec un jeton invalide',
      );
      throw new ForbiddenException('Jeton invalide');
    }

    const summary = await this.reminders.run();
    this.logger.log(
      `Tournée déclenchée de l'extérieur : ${summary.sent} envoyé(s), ` +
        `${summary.alreadySent} déjà notifié(s), ${summary.failed} en erreur`,
    );

    // Le point hebdomadaire suit le même chemin : c'est cet appel qui réveille
    // l'instance, et le planificateur interne ne s'exécute pas quand elle
    // dort. Le service décide lui-même s'il y a lieu d'envoyer aujourd'hui.
    const digest = await this.digest.run();
    if (digest.sent > 0 || digest.failed > 0) {
      this.logger.log(
        `Point hebdomadaire : ${digest.sent} envoyé(s), ${digest.failed} en erreur`,
      );
    }

    return { ...summary, digest };
  }

  /** Comparaison à durée constante, pour ne rien révéler du jeton attendu. */
  private matches(received: string | undefined, expected: string): boolean {
    if (!received) return false;
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
