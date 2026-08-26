import { Module } from '@nestjs/common';
import { ResiliationController } from './resiliation.controller';
import { ResiliationService } from './resiliation.service';
import { BudgetIaService } from './budget-ia.service';
import { AnalysisModule } from '../analysis/analysis.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AnalysisModule, AiModule],
  controllers: [ResiliationController],
  providers: [ResiliationService, BudgetIaService],
})
export class ResiliationModule {}
