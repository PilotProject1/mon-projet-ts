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
}
