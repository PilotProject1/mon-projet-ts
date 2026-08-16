import { Controller, Get, UseGuards } from '@nestjs/common';
import { RecurrencesService } from './recurrences.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

/*
 * Aucune restriction de plan : le calcul est local et ne coûte rien à
 * exécuter. Un compte gratuit qui découvre ici un abonnement oublié aura
 * compris à quoi sert le service — c'est la meilleure démonstration possible.
 */
@UseGuards(JwtAuthGuard)
@Controller('recurrences')
export class RecurrencesController {
  constructor(private readonly recurrences: RecurrencesService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.recurrences.forUser(user.userId);
  }
}
