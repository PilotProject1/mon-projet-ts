import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { RemindersController } from './reminders.controller';
import { BriefingModule } from '../briefing/briefing.module';

@Module({
  imports: [MailModule, PushModule, BriefingModule],
  controllers: [NotificationsController, RemindersController],
  providers: [NotificationsService, RemindersService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
