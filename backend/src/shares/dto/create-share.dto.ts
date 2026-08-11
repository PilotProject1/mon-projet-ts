import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export const SHARE_DURATIONS_HOURS = [24, 168, 720] as const;

export class CreateShareDto {
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsIn(SHARE_DURATIONS_HOURS)
  expiresInHours: number;
}
