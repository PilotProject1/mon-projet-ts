import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';
import { CreateInvoiceDto } from './create-invoice.dto';

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;
}
