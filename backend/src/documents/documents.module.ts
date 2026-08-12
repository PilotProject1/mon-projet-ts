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
})
export class DocumentsModule {}
