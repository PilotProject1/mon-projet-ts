import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

/**
 * Réserve une route aux comptes d'administration.
 *
 * Le rôle n'est pas lu dans le jeton mais dans la base, à chaque requête :
 * c'est la stratégie JWT qui le recharge. Un rôle retiré prend donc effet
 * immédiatement, sans attendre l'expiration d'un jeton déjà émis.
 *
 * Le refus est un 403 sans détail. Répondre « vous n'êtes pas administrateur »
 * confirmerait l'existence de la route à qui la cherche.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUserPayload }>();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Accès réservé');
    }
    return true;
  }
}
