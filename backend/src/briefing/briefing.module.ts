import { Module } from '@nestjs/common';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';
import { PlansModule } from '../plans/plans.module';
import { RecurrencesModule } from '../recurrences/recurrences.module';

@Module({
  imports: [PlansModule, RecurrencesModule],
  controllers: [BriefingController],
  providers: [BriefingService],
})
export class BriefingModule {}
