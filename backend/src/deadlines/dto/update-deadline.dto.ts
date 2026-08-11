import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { DeadlineStatus } from '@prisma/client';
import { CreateDeadlineDto } from './create-deadline.dto';

export class UpdateDeadlineDto extends PartialType(
  OmitType(CreateDeadlineDto, ['userId'] as const),
) {
  @IsEnum(DeadlineStatus)
  @IsOptional()
  status?: DeadlineStatus;
}
