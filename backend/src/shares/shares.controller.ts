import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SharesService } from './shares.service';
import { CreateShareDto } from './dto/create-share.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanFeatureGuard } from '../plans/plan-feature.guard';
import { RequiresFeature } from '../plans/requires-feature.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PlanFeatureGuard)
@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  // Seule la création est réservée aux plans payants : lister et révoquer
  // restent toujours accessibles, sinon un compte redescendu en gratuit ne
  // pourrait plus couper un lien de partage déjà diffusé.
  @Post()
  @RequiresFeature('partage')
  create(@Body() dto: CreateShareDto, @CurrentUser() user: CurrentUserPayload) {
    return this.sharesService.create(dto, user.userId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.sharesService.findAll(user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.sharesService.revoke(id, user.userId);
  }
}
