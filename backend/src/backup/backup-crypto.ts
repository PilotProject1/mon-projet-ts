import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

/*
 * Chiffrement des sauvegardes.
 *
 * Une sauvegarde est la base entière dans un seul fichier : documents lus,
 * adresses, échéances, factures. Elle est donc plus sensible que n'importe
 * quelle requête, et elle part se poser chez un prestataire de stockage.
 *
 * Elle est chiffrée ici, dans l'application, avec une clé qui n'existe que
 * dans l'environnement du serveur. C'est ce qui permet de déposer les
 * sauvegardes à côté des documents sans que le compte de stockage devienne un
 * point unique de compromission : qui obtient le fichier n'obtient rien.
 *
 * AES-256-GCM : le déchiffrement échoue si le contenu a été modifié, plutôt
 * que de rendre des octets faux — sur une sauvegarde, une corruption
 * silencieuse serait pire que l'absence de sauvegarde, parce qu'on ne la
 * découvrirait qu'en essayant de restaurer.
 */

const ALGORITHME = 'aes-256-gcm';
/** Repère de format, en tête de fichier : dit ce qu'on lit avant de l'ouvrir. */
const MARQUE = Buffer.from('SYNBAK01');
const SEL = 'syneco.sauvegardes.v1';
const LONGUEUR_MINIMALE = 32;
const TAILLE_IV = 12;
const TAILLE_MARQUE_AUTH = 16;

let cleDerivee: Buffer | null = null;
let cleSource: string | null = null;

export function chiffrementDisponible(): boolean {
  const brute = process.env.BACKUP_KEY;
  return typeof brute === 'string' && brute.length >= LONGUEUR_MINIMALE;
}

function cle(): Buffer {
  const brute = process.env.BACKUP_KEY;
  if (!brute || brute.length < LONGUEUR_MINIMALE) {
    throw new Error(
      `BACKUP_KEY absente ou trop courte (${LONGUEUR_MINIMALE} caractères au moins)`,
    );
  }
  if (cleSource !== brute) {
    cleDerivee = scryptSync(brute, SEL, 32);
    cleSource = brute;
  }
  return cleDerivee as Buffer;
}

/** Enveloppe : marque · vecteur d'initialisation · marque d'authenticité · contenu. */
export function chiffrer(clair: Buffer): Buffer {
  const iv = randomBytes(TAILLE_IV);
  const chiffreur = createCipheriv(ALGORITHME, cle(), iv);
  const contenu = Buffer.concat([chiffreur.update(clair), chiffreur.final()]);
  return Buffer.concat([MARQUE, iv, chiffreur.getAuthTag(), contenu]);
}

export function dechiffrer(enveloppe: Buffer): Buffer {
  const enTete = MARQUE.length + TAILLE_IV + TAILLE_MARQUE_AUTH;
  if (
    enveloppe.length < enTete ||
    !enveloppe.subarray(0, MARQUE.length).equals(MARQUE)
  ) {
    throw new Error(
      "Ce fichier n'est pas une sauvegarde SYNeco, ou son en-tête est abîmé",
    );
  }

  const iv = enveloppe.subarray(MARQUE.length, MARQUE.length + TAILLE_IV);
  const marqueAuth = enveloppe.subarray(MARQUE.length + TAILLE_IV, enTete);

  const dechiffreur = createDecipheriv(ALGORITHME, cle(), iv);
  dechiffreur.setAuthTag(marqueAuth);
  return Buffer.concat([
    dechiffreur.update(enveloppe.subarray(enTete)),
    dechiffreur.final(),
  ]);
}
