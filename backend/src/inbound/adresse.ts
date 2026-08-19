import { randomInt } from 'crypto';

/*
 * L'adresse de dépôt : depot-<jeton>@depot.syneco.pro
 *
 * Le jeton n'est pas un identifiant, c'est un secret. L'expéditeur d'un
 * courriel se falsifie en trois lignes : accepter « tout message venant de
 * l'adresse du compte » permettrait à n'importe qui de glisser un document
 * dans le coffre de quelqu'un d'autre. Seule la part inconnue de l'adresse
 * de destination empêche cela, et c'est pour cette raison qu'elle est tirée
 * au hasard et qu'elle se régénère.
 *
 * Un sous-domaine dédié, jamais le domaine principal : celui-ci porte déjà
 * la messagerie de l'éditeur, et lui toucher ses enregistrements MX ferait
 * disparaître son courrier.
 */

/** Sans voyelle : aucun jeton ne formera de mot, en français comme ailleurs. */
const ALPHABET = 'bcdfghjkmnpqrstvwxz23456789';
/** 16 caractères sur 27 possibles : environ 76 bits. */
const LONGUEUR = 16;

export function nouveauJeton(): string {
  let jeton = '';
  for (let i = 0; i < LONGUEUR; i += 1) {
    jeton += ALPHABET[randomInt(ALPHABET.length)];
  }
  return jeton;
}

/** Le domaine de réception, ou null si la fonctionnalité n'est pas configurée. */
export function domaineDeDepot(): string | null {
  const domaine = process.env.INBOUND_DOMAIN?.trim().toLowerCase();
  return domaine ? domaine : null;
}

export function adressePour(jeton: string, domaine: string): string {
  return `depot-${jeton}@${domaine}`;
}

/**
 * Retrouve le jeton dans une adresse de destination.
 *
 * Tolère ce que les serveurs de messagerie font subir à une adresse en
 * chemin : casse changée, chevrons, nom affiché devant. Rend null dès que
 * quelque chose ne colle pas — mieux vaut ignorer un message que le déposer
 * dans le mauvais compte.
 */
export function jetonDansAdresse(
  destinataire: string,
  domaine: string,
): string | null {
  const brut = destinataire.toLowerCase();
  const entreChevrons = brut.match(/<([^>]+)>/);
  const adresse = (entreChevrons ? entreChevrons[1] : brut).trim();

  const attendu = `@${domaine.toLowerCase()}`;
  if (!adresse.endsWith(attendu)) return null;

  const partieLocale = adresse.slice(0, -attendu.length);
  const correspondance = partieLocale.match(/^depot-([a-z0-9]+)$/);
  if (!correspondance) return null;

  const jeton = correspondance[1];
  return jeton.length === LONGUEUR ? jeton : null;
}
