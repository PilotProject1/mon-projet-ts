import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  // Temporaire : tant que l'authentification (Phase 5) n'existe pas,
  // le client doit indiquer explicitement le propriétaire du document.
  @IsString()
  @IsNotEmpty()
  userId: string;
}
