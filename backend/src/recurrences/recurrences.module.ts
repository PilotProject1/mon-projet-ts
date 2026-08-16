import { Module } from '@nestjs/common';
import { RecurrencesController } from './recurrences.controller';
import { RecurrencesService } from './recurrences.service';

@Module({
  controllers: [RecurrencesController],
  providers: [RecurrencesService],
})
export class RecurrencesModule {}
