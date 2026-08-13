import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
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
}
