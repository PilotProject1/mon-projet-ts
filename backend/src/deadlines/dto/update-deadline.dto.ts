import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { DeadlineStatus } from '@prisma/client';
import { CreateDeadlineDto } from './create-deadline.dto';

export class UpdateDeadlineDto extends PartialType(CreateDeadlineDto) {
  @IsEnum(DeadlineStatus)
  @IsOptional()
  status?: DeadlineStatus;
}
