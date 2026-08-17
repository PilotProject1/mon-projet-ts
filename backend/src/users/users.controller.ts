import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Copie de toutes ses données, au format JSON.
   *
   * L'en-tête de disposition fait proposer un enregistrement plutôt qu'un
   * affichage : le fichier a vocation à être conservé, pas lu dans un
   * onglet.
   */
  @Get('moi/export')
  @Header('Content-Type', 'application/json; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="syneco-mes-donnees.json"')
  exporterMesDonnees(@CurrentUser() user: CurrentUserPayload) {
    return this.users.exporterDonnees(user.userId);
  }

  /**
   * Suppression définitive de son propre compte.
   *
   * Aucun identifiant en paramètre : on ne peut supprimer que le sien. Le
   * mot de passe est redemandé dans le corps de la requête.
   */
  @Delete('moi')
  @HttpCode(204)
  async supprimerMonCompte(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.users.deleteAccount(user.userId, dto.password);
  }
}
