import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  /** Rappels d'échéance envoyés par e-mail. */
  @IsBoolean()
  emailReminders!: boolean;

  /**
   * Point hebdomadaire par e-mail. Facultatif : l'interface d'origine
   * n'envoyait que la première préférence, et une version ancienne du client
   * ne doit pas éteindre par mégarde une option qu'elle ignore.
   */
  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;
}
