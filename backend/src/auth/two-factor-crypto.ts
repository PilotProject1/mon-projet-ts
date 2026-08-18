import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

/*
 * Chiffrement du secret de double authentification.
 *
 * Le secret partagé avec l'application d'authentification est l'équivalent
 * d'un trousseau : qui le détient fabrique des codes valides indéfiniment.
 * Le conserver en clair reviendrait à ce qu'une copie de la base suffise à
 * franchir le second facteur — or la base est chez un tiers, et la
 * documentation de sécurité dit sans détour que ce tiers peut techniquement
 * la lire.
 *
 * Il est donc chiffré ici, dans l'application, avec une clé qui ne se trouve
 * que dans l'environnement du serveur. AES-256-GCM : le déchiffrement échoue
 * si le contenu a été modifié, plutôt que de rendre des octets faux.
 *
 * Sans TWO_FACTOR_KEY, rien ne casse : l'activation est refusée avec un
 * message clair, et les comptes déjà protégés gardent leurs codes de secours,
 * dont les empreintes ne dépendent pas de cette clé. C'est délibéré — une
 * variable oubliée chez l'hébergeur ne doit enfermer personne dehors.
 */

const ALGORITHME = 'aes-256-gcm';
const VERSION = 'v1';
const SEL = 'syneco.double-authentification.v1';
const LONGUEUR_MINIMALE = 32;

let cleDerivee: Buffer | null = null;
let cleSource: string | null = null;

export function chiffrementDisponible(): boolean {
  const brute = process.env.TWO_FACTOR_KEY;
  return typeof brute === 'string' && brute.length >= LONGUEUR_MINIMALE;
}

function cle(): Buffer {
  const brute = process.env.TWO_FACTOR_KEY;
  if (!brute || brute.length < LONGUEUR_MINIMALE) {
    throw new Error(
      `TWO_FACTOR_KEY absente ou trop courte (${LONGUEUR_MINIMALE} caractères au moins)`,
    );
  }
  // La dérivation coûte une centaine de millisecondes : on la garde en
  // mémoire, et on la refait si la variable change — ce qui n'arrive qu'en
  // test, mais un cache qui ment est pire qu'un cache absent.
  if (cleSource !== brute) {
    cleDerivee = scryptSync(brute, SEL, 32);
    cleSource = brute;
  }
  return cleDerivee as Buffer;
}

export function chiffrer(clair: string): string {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv(ALGORITHME, cle(), iv);
  const charge = Buffer.concat([
    chiffreur.update(clair, 'utf8'),
    chiffreur.final(),
  ]);
  const marque = chiffreur.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    marque.toString('base64'),
    charge.toString('base64'),
  ].join('.');
}

export function dechiffrer(stocke: string): string {
  const morceaux = stocke.split('.');
  if (morceaux.length !== 4 || morceaux[0] !== VERSION) {
    throw new Error('Secret de double authentification illisible');
  }
  const [, iv, marque, charge] = morceaux;
  const dechiffreur = createDecipheriv(
    ALGORITHME,
    cle(),
    Buffer.from(iv, 'base64'),
  );
  dechiffreur.setAuthTag(Buffer.from(marque, 'base64'));
  return Buffer.concat([
    dechiffreur.update(Buffer.from(charge, 'base64')),
    dechiffreur.final(),
  ]).toString('utf8');
}
