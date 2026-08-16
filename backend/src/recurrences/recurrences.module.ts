import { Module } from '@nestjs/common';
import { RecurrencesController } from './recurrences.controller';
import { RecurrencesService } from './recurrences.service';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PlansModule],
  controllers: [RecurrencesController],
  providers: [RecurrencesService],
  exports: [RecurrencesService],
})
export class RecurrencesModule {}
