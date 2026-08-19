import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { StorageModule } from '../storage/storage.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [StorageModule, AnalysisModule, AiModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  // Exporté pour le dépôt par e-mail, qui crée des documents par la même
  // chaîne que le dépôt depuis le site — quota, stockage et lecture compris.
  exports: [DocumentsService],
})
export class DocumentsModule {}
