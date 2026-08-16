import { Controller, Get, UseGuards } from '@nestjs/common';
import { BriefingService } from './briefing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('briefing')
export class BriefingController {
  constructor(private readonly briefing: BriefingService) {}

  @Get()
  forUser(@CurrentUser() user: CurrentUserPayload) {
    return this.briefing.forUser(user.userId);
  }
}
