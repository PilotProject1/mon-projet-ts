import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DeadlinePriority } from '@prisma/client';

export class CreateDeadlineDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  dueDate: string;

  @IsEnum(DeadlinePriority)
  priority: DeadlinePriority;

  @IsString()
  @IsOptional()
  documentId?: string;

  // Temporaire : tant que l'authentification (Phase 5) n'existe pas,
  // le client doit indiquer explicitement le propriétaire de l'échéance.
  @IsString()
  @IsNotEmpty()
  userId: string;
}
