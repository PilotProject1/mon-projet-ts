import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as QRCode from 'qrcode';
import { nouveauSecret, uriOtpauth, verifierCode } from './totp';
import { PrismaService } from '../prisma/prisma.service';
import {
  chiffrer,
  chiffrementDisponible,
  dechiffrer,
} from './two-factor-crypto';

/*
 * Double authentification par code à usage unique (TOTP, RFC 6238).
 *
 * Le mot de passe seul protège mal : il se réutilise d'un site à l'autre, et
 * il fuite ailleurs que chez nous. Un second facteur rend une fuite de mot de
 * passe insuffisante — c'est le manque que la documentation de sécurité
 * signalait en tête de liste.
 *
 * Trois principes tiennent le reste de ce fichier :
 *
 *  1. L'activation se fait en deux temps. Le secret proposé attend dans
 *     `twoFactorPendingSecret` tant qu'un premier code n'a pas prouvé que
 *     l'application d'authentification est bien configurée. Une préparation
 *     abandonnée ne ferme donc jamais un compte.
 *  2. Un code ne sert qu'une fois. Le pas de temps accepté est conservé, et
 *     tout code appartenant à ce pas ou à un pas antérieur est refusé —
 *     un code lu par-dessus l'épaule ne vaut plus rien.
 *  3. Il existe toujours une porte de secours. Dix codes, montrés une seule
 *     fois, conservés en empreinte bcrypt comme des mots de passe. Un
 *     téléphone se perd ; un compte ne doit pas se perdre avec lui.
 */

const NOM_DU_SERVICE = 'SYNeco';
const NOMBRE_DE_CODES = 10;
const LONGUEUR_DUN_CODE = 10;
/** Sans 0/O ni 1/I/L : ces codes se recopient à la main, souvent mal. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface PreparationDeuxiemeFacteur {
  secret: string;
  uri: string;
  qrCode: string;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(private readonly prisma: PrismaService) {}

  private exigeChiffrement() {
    if (!chiffrementDisponible()) {
      throw new ServiceUnavailableException(
        "La double authentification n'est pas configurée sur ce serveur",
      );
    }
  }

  private nouveauCode(): string {
    let code = '';
    for (let i = 0; i < LONGUEUR_DUN_CODE; i += 1) {
      code += ALPHABET[randomInt(ALPHABET.length)];
    }
    return code;
  }

  /** Un code de secours se lit et se recopie : on le montre en deux moitiés. */
  private presente(code: string): string {
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  }

  private normalise(saisie: string): string {
    return saisie.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private async remplaceLesCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: NOMBRE_DE_CODES }, () =>
      this.nouveauCode(),
    );
    const empreintes = await Promise.all(
      codes.map((code) => bcrypt.hash(code, 10)),
    );

    await this.prisma.$transaction([
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorRecoveryCode.createMany({
        data: empreintes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);

    return codes.map((code) => this.presente(code));
  }

  /**
   * Ce que l'interface a besoin de savoir : protégé ou non, depuis quand, et
   * combien de codes de secours restent. Jamais le secret.
   */
  async etat(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabledAt: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable');

    const codesDeSecoursRestants = user.twoFactorEnabledAt
      ? await this.prisma.twoFactorRecoveryCode.count({
          where: { userId, usedAt: null },
        })
      : 0;

    return {
      actif: user.twoFactorEnabledAt !== null,
      activeeLe: user.twoFactorEnabledAt,
      codesDeSecoursRestants,
      disponible: chiffrementDisponible(),
    };
  }

  /**
   * Premier temps : proposer un secret, sans rien activer.
   *
   * Le secret est rendu en clair — il faut bien que l'application
   * d'authentification le reçoive — mais il n'est conservé que chiffré, et il
   * ne protégera le compte qu'une fois confirmé par un code.
   */
  async preparer(userId: string): Promise<PreparationDeuxiemeFacteur> {
    this.exigeChiffrement();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabledAt: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable');
    if (user.twoFactorEnabledAt) {
      throw new BadRequestException(
        'La double authentification est déjà active sur ce compte',
      );
    }

    const secret = nouveauSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorPendingSecret: chiffrer(secret) },
    });

    const uri = uriOtpauth({
      editeur: NOM_DU_SERVICE,
      compte: user.email,
      secret,
    });

    return { secret, uri, qrCode: await QRCode.toDataURL(uri) };
  }

  /**
   * Second temps : un code prouve que l'application est correctement réglée.
   * C'est seulement là que le compte devient protégé, et que les codes de
   * secours sont créés — les montrer plus tôt reviendrait à les donner pour
   * une protection qui n'existe pas encore.
   */
  async activer(
    userId: string,
    code: string,
  ): Promise<{ codesDeSecours: string[] }> {
    this.exigeChiffrement();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorPendingSecret: true, twoFactorEnabledAt: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable');
    if (user.twoFactorEnabledAt) {
      throw new BadRequestException(
        'La double authentification est déjà active sur ce compte',
      );
    }
    if (!user.twoFactorPendingSecret) {
      throw new BadRequestException(
        'Aucune activation en cours : recommencez depuis le début',
      );
    }

    const resultat = verifierCode(
      dechiffrer(user.twoFactorPendingSecret),
      this.normalise(code),
    );
    if (!resultat) {
      throw new BadRequestException('Code incorrect');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorEnabledAt: new Date(),
        twoFactorLastStep: resultat.pas,
      },
    });

    this.logger.log(`Double authentification activée sur le compte ${userId}`);
    return { codesDeSecours: await this.remplaceLesCodes(userId) };
  }

  /**
   * Retirer la protection demande le mot de passe *et* un code : sans quoi un
   * jeton volé suffirait à désarmer ce qui devait le rendre inoffensif.
   */
  async desactiver(userId: string, motDePasse: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable');
    if (!user.twoFactorEnabledAt) {
      throw new BadRequestException(
        "La double authentification n'est pas active sur ce compte",
      );
    }

    if (!(await bcrypt.compare(motDePasse, user.passwordHash))) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }
    await this.verifierCode(user, code);

    await this.prisma.$transaction([
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: null,
          twoFactorPendingSecret: null,
          twoFactorEnabledAt: null,
          twoFactorLastStep: null,
        },
      }),
    ]);

    this.logger.log(`Double authentification retirée du compte ${userId}`);
  }

  /**
   * Refaire une série de codes de secours : les anciens cessent aussitôt de
   * valoir. Utile quand il n'en reste plus beaucoup, ou qu'on ne sait plus où
   * est la feuille sur laquelle ils étaient notés.
   */
  async renouvelerLesCodes(userId: string, motDePasse: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable');
    if (!user.twoFactorEnabledAt) {
      throw new BadRequestException(
        "La double authentification n'est pas active sur ce compte",
      );
    }

    if (!(await bcrypt.compare(motDePasse, user.passwordHash))) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }
    await this.verifierCode(user, code);

    return { codesDeSecours: await this.remplaceLesCodes(userId) };
  }

  /**
   * Vérifie un code, qu'il vienne de l'application d'authentification ou de
   * la feuille de secours. Lève si rien ne correspond.
   *
   * L'ordre compte : on essaie d'abord le code temporel, de loin le cas
   * courant, et on ne parcourt les empreintes de secours qu'ensuite.
   */
  async verifierCode(
    user: {
      id: string;
      twoFactorSecret: string | null;
      twoFactorLastStep: number | null;
    },
    code: string,
  ): Promise<void> {
    const saisie = this.normalise(code);
    if (!saisie) throw new UnauthorizedException('Code incorrect');

    if (
      user.twoFactorSecret &&
      chiffrementDisponible() &&
      /^\d{6}$/.test(saisie)
    ) {
      const resultat = verifierCode(dechiffrer(user.twoFactorSecret), saisie, {
        // Refuse un code déjà présenté, y compris pendant les secondes où il
        // reste par ailleurs valide.
        apresPas: user.twoFactorLastStep,
      });
      if (resultat) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { twoFactorLastStep: resultat.pas },
        });
        return;
      }
    }

    const codes = await this.prisma.twoFactorRecoveryCode.findMany({
      where: { userId: user.id, usedAt: null },
    });
    for (const candidat of codes) {
      if (await bcrypt.compare(saisie, candidat.codeHash)) {
        await this.prisma.twoFactorRecoveryCode.update({
          where: { id: candidat.id },
          data: { usedAt: new Date() },
        });
        this.logger.warn(
          `Code de secours utilisé sur le compte ${user.id} : ${codes.length - 1} restant(s)`,
        );
        return;
      }
    }

    throw new UnauthorizedException('Code incorrect');
  }
}
