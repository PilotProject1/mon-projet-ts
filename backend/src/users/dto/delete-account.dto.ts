import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteAccountDto {
  /**
   * Mot de passe du compte, redemandé au moment de la suppression.
   *
   * Un jeton volé suffirait sinon à effacer définitivement les documents de
   * quelqu'un. C'est l'action la plus irréversible de l'application : elle
   * mérite qu'on prouve à nouveau son identité.
   */
  @IsString()
  @IsNotEmpty()
  password: string;
}
