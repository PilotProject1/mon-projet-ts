import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { typeReel } from '../documents/file-signature';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../documents/file-upload.constants';
import {
  adressePour,
  domaineDeDepot,
  jetonDansAdresse,
  nouveauJeton,
} from './adresse';
import {
  receptionConfiguree,
  telechargerPieceJointe,
  type ChargeBrevo,
} from './brevo';

/*
 * Dépôt de documents par courriel.
 *
 * Une facture arrive aujourd'hui par e-mail : il faut télécharger la pièce
 * jointe, ouvrir le site, la redéposer. Transférer le message, c'est deux
 * gestes au lieu de cinq, et c'est fait depuis l'endroit où le document est
 * déjà.
 *
 * Le message transféré n'est pas cru sur parole. Rien de ce qu'il annonce
 * n'est retenu : ni son expéditeur, qui se falsifie, ni le type des pièces
 * jointes, qui se déclare. Seule l'adresse de destination, dont le jeton est
 * secret, désigne le compte ; et le contenu des fichiers est vérifié par sa
 * signature, exactement comme un dépôt fait depuis le site.
 */

export interface ResumeReception {
  /** Messages reçus dans l'appel. */
  messages: number;
  /** Documents effectivement créés. */
  deposes: number;
  /** Pièces écartées, avec la raison. */
  ecartees: string[];
}

@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  /** Vrai quand le domaine de réception et la clé du prestataire sont posés. */
  configure(): boolean {
    return domaineDeDepot() !== null && receptionConfiguree();
  }

  /**
   * L'adresse du compte, créée à la première demande.
   *
   * Pas à l'inscription : une adresse qui existe est une porte ouverte, et
   * on n'en ouvre pas pour quelqu'un qui n'a rien demandé.
   */
  async adresse(
    userId: string,
  ): Promise<{ adresse: string | null; disponible: boolean }> {
    const domaine = domaineDeDepot();
    if (!domaine || !this.configure())
      return { adresse: null, disponible: false };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { inboundToken: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable');

    const jeton = user.inboundToken ?? (await this.poserUnJeton(userId));
    return { adresse: adressePour(jeton, domaine), disponible: true };
  }

  /** Change l'adresse. L'ancienne cesse aussitôt de fonctionner. */
  async regenerer(userId: string): Promise<{ adresse: string }> {
    const domaine = domaineDeDepot();
    if (!domaine || !this.configure()) {
      throw new ServiceUnavailableException(
        "Le dépôt par e-mail n'est pas configuré sur ce serveur",
      );
    }
    const jeton = await this.poserUnJeton(userId);
    this.logger.log(`Adresse de dépôt renouvelée pour le compte ${userId}`);
    return { adresse: adressePour(jeton, domaine) };
  }

  /*
   * La contrainte d'unicité est portée par la base : deux comptes ne peuvent
   * pas recevoir le même jeton, même si deux requêtes se croisent. En cas de
   * collision — improbable sur 76 bits, mais on ne pariera pas dessus — on
   * retire un autre jeton plutôt que d'échouer.
   */
  private async poserUnJeton(userId: string): Promise<string> {
    for (let essai = 0; essai < 5; essai += 1) {
      const jeton = nouveauJeton();
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { inboundToken: jeton },
        });
        return jeton;
      } catch {
        // Jeton déjà pris : on retire.
      }
    }
    throw new ServiceUnavailableException(
      "Impossible d'attribuer une adresse de dépôt",
    );
  }

  /**
   * Traite ce que le prestataire de réception envoie.
   *
   * Ne lève jamais sur un message mal formé : le prestataire réessaierait,
   * et un message qu'on ne sait pas traiter ne se traitera pas mieux au
   * dixième essai. Ce qui est écarté est journalisé, pas renvoyé.
   */
  async recevoir(charge: ChargeBrevo): Promise<ResumeReception> {
    const domaine = domaineDeDepot();
    const resume: ResumeReception = { messages: 0, deposes: 0, ecartees: [] };
    if (!domaine) return resume;

    for (const message of charge.items ?? []) {
      resume.messages += 1;

      const destinataires = (message.To ?? [])
        .map((d) => d.Address ?? '')
        .filter(Boolean);
      const jeton = destinataires
        .map((adresse) => jetonDansAdresse(adresse, domaine))
        .find((j): j is string => j !== null);

      if (!jeton) {
        resume.ecartees.push('destinataire inconnu');
        continue;
      }

      const user = await this.prisma.user.findUnique({
        where: { inboundToken: jeton },
        select: { id: true },
      });
      if (!user) {
        // Adresse d'un compte supprimé, ou jeton renouvelé depuis l'envoi.
        this.logger.warn('Message reçu sur une adresse de dépôt inconnue');
        resume.ecartees.push('adresse révoquée');
        continue;
      }

      const pieces = message.Attachments ?? [];
      if (pieces.length === 0) {
        resume.ecartees.push('aucune pièce jointe');
        continue;
      }

      for (const piece of pieces) {
        const raison = await this.deposer(user.id, piece, message.Subject);
        if (raison === null) resume.deposes += 1;
        else resume.ecartees.push(raison);
      }
    }

    if (resume.deposes > 0 || resume.ecartees.length > 0) {
      this.logger.log(
        `Réception : ${resume.messages} message(s), ${resume.deposes} document(s) déposé(s)` +
          (resume.ecartees.length
            ? `, écarté : ${resume.ecartees.join(', ')}`
            : ''),
      );
    }
    return resume;
  }

  /** Rend null si le dépôt a réussi, sinon la raison du refus. */
  private async deposer(
    userId: string,
    piece: { Name?: string; ContentType?: string; DownloadToken?: string },
    sujet?: string,
  ): Promise<string | null> {
    if (!piece.DownloadToken) return 'pièce sans jeton de téléchargement';

    const contenu = await telechargerPieceJointe(
      piece.DownloadToken,
      this.logger,
    );
    if (!contenu) return 'pièce non récupérée';
    if (contenu.length > MAX_FILE_SIZE_BYTES) return 'pièce trop volumineuse';

    /*
     * Le type annoncé par le message ne décide de rien : c'est la signature
     * du contenu qui tranche, comme pour un dépôt fait depuis le site. Un
     * exécutable transféré en pièce jointe est refusé ici.
     */
    const reel = typeReel(contenu);
    if (!reel || !ALLOWED_MIME_TYPES.includes(reel)) {
      return 'type de fichier refusé';
    }

    const nom = this.nommer(piece.Name, sujet);
    try {
      await this.documents.create({ name: nom }, userId, {
        buffer: contenu,
        mimetype: reel,
        originalname: nom,
        size: contenu.length,
      } as Express.Multer.File);
      return null;
    } catch (err) {
      // Quota atteint, stockage indisponible : on le dit sans faire échouer
      // le reste du message.
      return (err as Error).message || 'dépôt refusé';
    }
  }

  /**
   * Le nom du fichier joint prime sur le sujet du message : « facture.pdf »
   * dit ce qu'est la pièce, là où « Re: Tr: votre facture » dit ce qu'en a
   * fait la boîte mail.
   */
  private nommer(nomPiece?: string, sujet?: string): string {
    const propre = (nomPiece ?? '').trim();
    if (propre) return propre.slice(0, 200);
    const objet = (sujet ?? '').trim();
    return (objet || 'Document reçu par e-mail').slice(0, 200);
  }
}
