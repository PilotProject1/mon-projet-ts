import { Global, Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { PlanFeatureGuard } from './plan-feature.guard';

@Global()
@Module({
  controllers: [PlansController],
  providers: [PlansService, PlanFeatureGuard],
  exports: [PlansService, PlanFeatureGuard],
})
export class PlansModule {}
