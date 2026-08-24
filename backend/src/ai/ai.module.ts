import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiExtractionService } from './ai-extraction.service';
import { AiLetterService } from './ai-letter.service';

@Module({
  providers: [AiService, AiExtractionService, AiLetterService],
  exports: [AiService, AiExtractionService, AiLetterService],
})
export class AiModule {}
