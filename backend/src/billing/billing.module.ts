import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { RenewalNoticeService } from './renewal-notice.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [BillingController],
  providers: [BillingService, RenewalNoticeService],
  exports: [BillingService],
})
export class BillingModule {}
