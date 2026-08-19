import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { InboundService } from './inbound.service';
import type { ChargeBrevo } from './brevo';

/*
 * Deux publics sur le même sujet, et donc deux protections différentes.
 *
 * L'utilisateur consulte et renouvelle son adresse : jeton d'accès habituel.
 *
 * Le prestataire de réception dépose ce qu'il a reçu : il ne peut pas
 * présenter de jeton d'accès, il n'est personne. Il présente une clé
 * partagée. Cette clé n'est toutefois pas ce qui protège les comptes — c'est
 * le jeton contenu dans l'adresse de destination, vérifié plus loin. Même
 * avec la clé, on ne dépose que là où l'on connaît déjà l'adresse.
 */
@Controller('depot-email')
export class InboundController {
  private readonly logger = new Logger(InboundController.name);

  constructor(private readonly inbound: InboundService) {}

  @Get('adresse')
  @UseGuards(JwtAuthGuard)
  adresse(@CurrentUser() user: CurrentUserPayload) {
    return this.inbound.adresse(user.userId);
  }

  @Post('regenerer')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  regenerer(@CurrentUser() user: CurrentUserPayload) {
    return this.inbound.regenerer(user.userId);
  }

  @Post('reception')
  @HttpCode(HttpStatus.OK)
  // Un prestataire de messagerie livre par rafales : la limite est large,
  // sans être absente.
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async reception(
    @Body() charge: ChargeBrevo,
    @Headers('x-depot-cle') cle?: string,
  ) {
    const attendue = process.env.INBOUND_WEBHOOK_KEY;
    if (!attendue) {
      // Sans clé configurée, le point d'entrée reste fermé : il ne doit
      // jamais s'ouvrir par simple absence de configuration.
      throw new ServiceUnavailableException(
        "Le dépôt par e-mail n'est pas configuré",
      );
    }
    if (!this.correspond(cle, attendue)) {
      this.logger.warn('Réception refusée : clé invalide');
      throw new ForbiddenException('Clé invalide');
    }

    return this.inbound.recevoir(charge);
  }

  /** Comparaison à durée constante, pour ne rien révéler de la clé attendue. */
  private correspond(recue: string | undefined, attendue: string): boolean {
    if (!recue) return false;
    const a = Buffer.from(recue);
    const b = Buffer.from(attendue);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
