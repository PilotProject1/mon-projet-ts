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
   * Copie de toutes les données d'un compte, dans un format lisible par une
   * machine comme par un humain.
   *
   * C'est le droit à la portabilité — article 20 du RGPD — et c'est aussi
   * une réponse à la question « qu'est-ce que vous savez de moi ». Un
   * service dont on peut partir avec ses données est un service qu'on
   * choisit plus volontiers.
   *
   * Ce que l'export ne contient pas, et pourquoi :
   *  - l'empreinte du mot de passe : elle n'apprend rien et n'a rien à
   *    faire dans un fichier qui circulera par courriel ;
   *  - les clés de stockage : un détail d'implémentation, sans usage hors
   *    du service ;
   *  - les jetons de partage encore actifs : ce sont des secrets vivants,
   *    et un export traîne. Les liens restent consultables dans
   *    l'application.
   *
   * Les fichiers eux-mêmes ne sont pas joints : les rassembler en archive
   * demanderait de tout charger en mémoire, ce qu'une instance modeste ne
   * supporterait pas. Ils se téléchargent un par un depuis la liste, et
   * l'export en donne l'inventaire complet.
   */
  async exporterDonnees(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
          include: { shareLinks: { include: { accesses: true } } },
        },
        deadlines: { orderBy: { dueDate: 'asc' } },
        contracts: { orderBy: { startDate: 'asc' } },
        company: { include: { clients: true, invoices: true } },
        notifications: { orderBy: { sentAt: 'asc' } },
      },
    });
    if (!user) throw new NotFoundException('Compte introuvable');

    return {
      exporteLe: new Date().toISOString(),
      avertissement:
        'Cet export contient vos données structurées. Les fichiers eux-mêmes ' +
        'se téléchargent depuis la liste des documents.',
      compte: {
        nom: user.name,
        email: user.email,
        offre: user.plan,
        creeLe: user.createdAt,
        pointHebdomadaire: user.weeklyDigest,
      },
      documents: user.documents.map((doc) => ({
        nom: doc.name,
        type: doc.type,
        format: doc.mimeType,
        tailleOctets: doc.sizeBytes,
        ajouteLe: doc.createdAt,
        emetteur: doc.provider,
        montant: doc.amount,
        dateDuDocument: doc.documentDate,
        reference: doc.reference,
        regle: doc.paid,
        texteLu: doc.extractedText,
        partages: doc.shareLinks.map((lien) => ({
          creeLe: lien.createdAt,
          expireLe: lien.expiresAt,
          revoque: lien.revokedAt !== null,
          consultations: lien.accesses.map((acces) => acces.accessedAt),
        })),
      })),
      echeances: user.deadlines.map((e) => ({
        intitule: e.title,
        echeanceLe: e.dueDate,
        statut: e.status,
      })),
      contrats: user.contracts.map((c) => ({
        fournisseur: c.provider,
        debut: c.startDate,
        fin: c.endDate,
        montant: c.amount,
        reconduction: c.renewalType,
      })),
      entreprise: user.company
        ? {
            nom: user.company.name,
            clients: user.company.clients.map((cl) => ({
              nom: cl.name,
              email: cl.email,
              telephone: cl.phone,
            })),
            factures: user.company.invoices.map((f) => ({
              numero: f.number,
              emiseLe: f.createdAt,
              echeanceLe: f.dueDate,
              total: f.total,
              statut: f.status,
            })),
          }
        : null,
      notifications: user.notifications.map((n) => ({
        message: n.message,
        canal: n.channel,
        envoyeLe: n.sentAt,
        lueLe: n.readAt,
      })),
    };
  }

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
