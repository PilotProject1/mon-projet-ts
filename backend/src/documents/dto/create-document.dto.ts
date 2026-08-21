import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentCategory, DocumentType } from '@prisma/client';

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

  /**
   * Maison, personnel ou famille. Omise de la même manière : la lecture du
   * document s'en charge, et ne revient pas sur un choix déjà fait ici.
   */
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;
}
