import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly billing: BillingService,
  ) {}

  /**
   * Efface définitivement un compte et tout ce qui s'y rattache.
   *
   * C'est l'action la plus irréversible du service, et la politique de
   * confidentialité la promet : « l'ensemble de vos documents, échéances,
   * contrats, partages, factures et notifications est supprimé
   * automatiquement et de façon définitive ».
   *
   * L'ordre n'est pas indifférent :
   *  1. le mot de passe est redemandé — un jeton volé ne doit pas suffire ;
   *  2. l'abonnement est résilié, sinon un compte effacé continuerait d'être
   *     prélevé sans que personne puisse l'arrêter ;
   *  3. les fichiers sont retirés du stockage, tant que la base sait encore
   *     où ils se trouvent ;
   *  4. la ligne du compte est supprimée, et quatorze relations en cascade
   *     emportent le reste.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable');

    const correspond = await bcrypt.compare(password, user.passwordHash);
    if (!correspond) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    await this.billing.annulerAbonnementAvantSuppression(userId);

    const documents = await this.prisma.document.findMany({
      where: { userId },
      select: { fileKey: true },
    });
    for (const { fileKey } of documents) {
      // Un fichier déjà absent ne doit pas empêcher la suppression : mieux
      // vaut un objet orphelin dans le stockage qu'un compte qu'on ne peut
      // plus effacer.
      await this.storage.delete(fileKey).catch((error: unknown) => {
        this.logger.warn(
          `Fichier ${fileKey} non supprimé : ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }

    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(
      `Compte ${userId} supprimé : ${documents.length} fichier(s) retiré(s)`,
    );
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: { email: string; passwordHash: string; name: string }) {
    return this.prisma.user.create({ data });
  }
}
