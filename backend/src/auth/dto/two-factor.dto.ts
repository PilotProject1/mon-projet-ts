import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/*
 * Un code tient en six chiffres, un code de secours en dix caractères avec
 * son tiret. La borne haute évite qu'une saisie absurde parcoure les
 * empreintes de secours pour rien.
 */

export class ActiverDeuxiemeFacteurDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}

export class RetirerDeuxiemeFacteurDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}

export class ConnexionDeuxiemeFacteurDto {
  @IsString()
  @IsNotEmpty()
  challengeToken: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}
