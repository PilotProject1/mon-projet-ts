import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDeadlineDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  @IsOptional()
  documentId?: string;
}
