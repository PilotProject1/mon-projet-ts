import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiExtractionService } from './ai-extraction.service';

@Module({
  providers: [AiService, AiExtractionService],
  exports: [AiService, AiExtractionService],
})
export class AiModule {}
