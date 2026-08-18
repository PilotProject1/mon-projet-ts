import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { decoderBase32, encoderBase32 } from './base32';

/*
 * Code à usage unique fondé sur le temps — TOTP, RFC 6238, lui-même bâti sur
 * HOTP, RFC 4226. C'est ce que lisent Google Authenticator, Aegis, 1Password
 * et les autres.
 *
 * Le principe tient en une phrase : le serveur et le téléphone partagent un
 * secret, découpent le temps en tranches de trente secondes, et calculent
 * chacun de leur côté un condensé du numéro de tranche. Personne n'envoie
 * jamais le secret, et le code cesse de valoir au bout d'une tranche.
 *
 * SHA-1 n'est pas un oubli : la RFC l'impose par défaut, et toutes les
 * applications d'authentification s'y attendent. Sa faiblesse connue porte
 * sur les collisions, sans effet sur HMAC.
 *
 * Vérifié sur les vecteurs publiés de la RFC 6238.
 */

/** Durée d'une tranche, en secondes. */
export const PERIODE = 30;
/** Longueur du code affiché. */
export const CHIFFRES = 6;

export interface ResultatVerification {
  /** Tranche à laquelle le code correspondait. */
  pas: number;
}

/** Secret de 20 octets (160 bits), la taille recommandée par la RFC 4226. */
export function nouveauSecret(octets = 20): string {
  return encoderBase32(randomBytes(octets));
}

export function pasDeTemps(secondes: number = Date.now() / 1000): number {
  return Math.floor(secondes / PERIODE);
}

/** Le code d'une tranche donnée. */
export function codePour(secret: string, pas: number): string {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(pas));

  const condense = createHmac('sha1', decoderBase32(secret))
    .update(compteur)
    .digest();

  // Troncature dynamique (RFC 4226, section 5.3) : les quatre derniers bits
  // désignent l'endroit où lire les quatre octets qui font le code.
  const depart = condense[condense.length - 1] & 0x0f;
  const nombre =
    ((condense[depart] & 0x7f) << 24) |
    (condense[depart + 1] << 16) |
    (condense[depart + 2] << 8) |
    condense[depart + 3];

  return (nombre % 10 ** CHIFFRES).toString().padStart(CHIFFRES, '0');
}

function memeCode(attendu: string, saisi: string): boolean {
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(saisi, 'utf8');
  // timingSafeEqual exige deux longueurs égales, et une comparaison de
  // longueurs n'apprend rien qu'on ne sache déjà : un code fait six chiffres.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vérifie un code.
 *
 * `tolerance` compte les tranches acceptées de part et d'autre : une seule,
 * soit trente secondes, ce qui couvre une horloge de téléphone légèrement
 * décalée sans allonger inutilement la fenêtre d'un code volé.
 *
 * `apresPas` refuse un code appartenant à une tranche déjà utilisée. C'est la
 * protection contre le rejeu : un code lu par-dessus l'épaule, ou intercepté,
 * ne resservira pas pendant les secondes où il reste par ailleurs valide.
 *
 * Rend la tranche retenue, ou null si rien ne correspond.
 */
export function verifierCode(
  secret: string,
  saisi: string,
  options: {
    tolerance?: number;
    apresPas?: number | null;
    maintenant?: number;
  } = {},
): ResultatVerification | null {
  const { tolerance = 1, apresPas = null } = options;
  if (!/^\d+$/.test(saisi) || saisi.length !== CHIFFRES) return null;

  const actuel = pasDeTemps(options.maintenant ?? Date.now() / 1000);

  for (let ecart = -tolerance; ecart <= tolerance; ecart += 1) {
    const pas = actuel + ecart;
    if (pas < 0) continue;
    if (apresPas !== null && pas <= apresPas) continue;
    if (memeCode(codePour(secret, pas), saisi)) return { pas };
  }

  return null;
}

/**
 * L'adresse `otpauth://` que lit l'application d'authentification, en général
 * par un code graphique.
 */
export function uriOtpauth(options: {
  editeur: string;
  compte: string;
  secret: string;
}): string {
  const etiquette = `${encodeURIComponent(options.editeur)}:${encodeURIComponent(options.compte)}`;
  const parametres = new URLSearchParams({
    secret: options.secret.replace(/=/g, ''),
    issuer: options.editeur,
    algorithm: 'SHA1',
    digits: String(CHIFFRES),
    period: String(PERIODE),
  });
  return `otpauth://totp/${etiquette}?${parametres.toString()}`;
}
