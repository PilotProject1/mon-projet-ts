import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.findAll(user.userId);
  }

  @Patch(':id/lue')
  markRead(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.markRead(id, user.userId);
  }
}
