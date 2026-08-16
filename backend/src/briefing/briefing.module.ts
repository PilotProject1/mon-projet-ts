import { Module } from '@nestjs/common';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';
import { WeeklyDigestService } from './weekly-digest.service';
import { PlansModule } from '../plans/plans.module';
import { RecurrencesModule } from '../recurrences/recurrences.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PlansModule, RecurrencesModule, MailModule],
  controllers: [BriefingController],
  providers: [BriefingService, WeeklyDigestService],
  exports: [WeeklyDigestService],
})
export class BriefingModule {}
