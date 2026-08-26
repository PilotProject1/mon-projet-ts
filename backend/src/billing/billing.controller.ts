import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: CurrentUserPayload) {
    return this.billing.createCheckoutSession(
      user.userId,
      dto.plan,
      dto.interval ?? 'mensuel',
    );
  }

  /**
   * Changement d'offre ou de périodicité pour un abonnement déjà en cours.
   * Distinct de `checkout`, qui ouvre une souscription : ici il n'y a rien à
   * payer sur-le-champ, la différence part sur la prochaine facture.
   */
  @UseGuards(JwtAuthGuard)
  @Post('subscription/change')
  changerOffre(
    @Body() dto: CheckoutDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.billing.changerOffre(
      user.userId,
      dto.plan,
      dto.interval ?? 'mensuel',
    );
  }

  /** Annule une résiliation programmée. */
  @UseGuards(JwtAuthGuard)
  @Post('subscription/resume')
  reprendre(@CurrentUser() user: CurrentUserPayload) {
    return this.billing.reprendreAbonnement(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('portal')
  portal(@CurrentUser() user: CurrentUserPayload) {
    return this.billing.createPortalSession(user.userId);
  }

  /**
   * Point d'entrée des webhooks Stripe. Volontairement non authentifié : c'est
   * la signature cryptographique qui atteste de l'origine de l'appel.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Signature Stripe manquante');
    }
    if (!request.rawBody) {
      throw new BadRequestException('Corps de requête brut indisponible');
    }

    let event;
    try {
      event = this.billing.constructEvent(request.rawBody, signature);
    } catch (err) {
      // Signature invalide : requête rejetée sans être traitée.
      this.logger.warn(
        `Webhook Stripe refusé : ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Signature Stripe invalide');
    }

    await this.billing.applyEvent(event);
    return { received: true };
  }
}
