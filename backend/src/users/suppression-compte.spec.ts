import { UsersService } from './users.service';
import * as bcrypt from 'bcryptjs';

/**
 * La suppression d'un compte est l'action la plus irréversible du service, et
 * la politique de confidentialité promet qu'elle est totale. Chaque cas
 * ci-dessous décrit une façon dont elle pourrait tenir moins que sa parole :
 * un prélèvement qui continue, une carte qui survit, ou une panne d'un
 * prestataire qui retient des données qui devraient partir.
 */
describe('UsersService — suppression de compte', () => {
  const MOT_DE_PASSE = 'MotDePasse123!';

  function monter(overrides: { effacementEchoue?: boolean } = {}) {
    const user = {
      id: 'u1',
      passwordHash: bcrypt.hashSync(MOT_DE_PASSE, 4),
    };
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        delete: jest.fn().mockResolvedValue({}),
      },
      document: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const ordre: string[] = [];
    const billing = {
      annulerAbonnementAvantSuppression: jest.fn(async () => {
        ordre.push('resiliation');
      }),
      effacerClientStripe: jest.fn(async () => {
        ordre.push('effacement');
        if (overrides.effacementEchoue) throw new Error('Stripe injoignable');
      }),
    };
    const service = new UsersService(prisma, storage as any, billing as any);
    return { service, prisma, billing, ordre };
  }

  it('résilie l’abonnement puis efface le client Stripe, dans cet ordre', async () => {
    const { service, ordre } = monter();
    await service.deleteAccount('u1', MOT_DE_PASSE);

    // La résiliation d'abord : c'est elle qui écarte le prélèvement sur un
    // compte que plus personne ne pourra arrêter.
    expect(ordre).toEqual(['resiliation', 'effacement']);
  });

  it('efface la ligne du compte', async () => {
    const { service, prisma } = monter();
    await service.deleteAccount('u1', MOT_DE_PASSE);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('refuse sans le mot de passe : un jeton volé ne suffit pas', async () => {
    const { service, prisma, billing } = monter();
    await expect(service.deleteAccount('u1', 'mauvais')).rejects.toThrow();
    expect(billing.annulerAbonnementAvantSuppression).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  /*
   * Le service de paiement peut être en panne. Retenir alors des données qui
   * doivent partir serait le pire des deux maux : le prélèvement est déjà
   * écarté par la résiliation qui précède.
   */
  it('supprime le compte même si l’effacement du client Stripe échoue', async () => {
    const { service, prisma } = monter({ effacementEchoue: true });
    await expect(
      service.deleteAccount('u1', MOT_DE_PASSE),
    ).resolves.toBeUndefined();
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});
