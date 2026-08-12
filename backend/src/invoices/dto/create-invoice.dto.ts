import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsNumber()
  @IsPositive()
  total: number;

  @IsDateString()
  dueDate: string;
}
