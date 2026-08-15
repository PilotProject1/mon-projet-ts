import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { SubscribePushDto, UnsubscribePushDto } from './dto/subscribe-push.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /**
   * Clé publique VAPID, nécessaire au navigateur pour s'abonner. Elle est
   * publique par nature ; l'exposer ne permet à personne d'envoyer en notre
   * nom, ce qui suppose la clé privée.
   */
  @Get('cle-publique')
  async publicKey(@CurrentUser() user: CurrentUserPayload) {
    return {
      publicKey: this.push.publicKey,
      available: this.push.available,
      devices: await this.push.countFor(user.userId),
    };
  }

  @Post('abonnements')
  subscribe(
    @Body() dto: SubscribePushDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.push.subscribe(user.userId, dto);
  }

  @Delete('abonnements')
  unsubscribe(
    @Body() dto: UnsubscribePushDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.push.unsubscribe(user.userId, dto.endpoint);
  }
}
