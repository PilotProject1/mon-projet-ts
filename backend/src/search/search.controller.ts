import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanFeatureGuard } from '../plans/plan-feature.guard';
import { RequiresFeature } from '../plans/requires-feature.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PlanFeatureGuard)
@RequiresFeature('ia')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  ask(@Body() dto: SearchQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.searchService.ask(dto.query, user.userId);
  }
}
