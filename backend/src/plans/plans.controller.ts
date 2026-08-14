import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PLANS, PURCHASABLE_PLANS } from './plan.config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('plan')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  /** Plan courant et consommation, pour l'affichage dans l'interface. */
  @Get()
  getMyPlan(@CurrentUser() user: CurrentUserPayload) {
    return this.plansService.getUsage(user.userId);
  }

  /**
   * Catalogue des offres. Servi par le serveur pour que les tarifs affichés
   * proviennent de la même source que ceux appliqués : un prix codé en dur
   * dans l'interface finirait par diverger de celui réellement facturé.
   */
  @Get('catalogue')
  getCatalogue() {
    return {
      plans: (Object.keys(PLANS) as (keyof typeof PLANS)[]).map((key) => ({
        plan: key,
        ...PLANS[key],
        purchasable: (PURCHASABLE_PLANS as readonly string[]).includes(key),
      })),
    };
  }
}
