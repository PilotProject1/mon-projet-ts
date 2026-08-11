import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { DocumentStatus } from '@prisma/client';
import { CreateDocumentDto } from './create-document.dto';

export class UpdateDocumentDto extends PartialType(
  OmitType(CreateDocumentDto, ['userId'] as const),
) {
  @IsEnum(DocumentStatus)
  @IsOptional()
  status?: DocumentStatus;
}
