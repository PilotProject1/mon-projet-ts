import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import { RenewalType } from '@prisma/client';

export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(RenewalType)
  renewalType: RenewalType;

  @IsString()
  @IsNotEmpty()
  documentId: string;
}
