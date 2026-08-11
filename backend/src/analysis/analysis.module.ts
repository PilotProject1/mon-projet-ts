import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { ExtractionService } from './extraction.service';

@Module({
  providers: [OcrService, ExtractionService],
  exports: [OcrService, ExtractionService],
})
export class AnalysisModule {}
