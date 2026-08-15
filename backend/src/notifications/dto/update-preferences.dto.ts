import { IsBoolean } from 'class-validator';

export class UpdatePreferencesDto {
  /** Rappels d'échéance envoyés par e-mail. */
  @IsBoolean()
  emailReminders!: boolean;
}
