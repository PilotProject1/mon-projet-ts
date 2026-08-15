import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Omis lorsque l'utilisateur laisse l'application reconnaître le document :
   * le type est alors déduit du texte après dépôt.
   */
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;
}
