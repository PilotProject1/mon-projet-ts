/*
 * Base32 (RFC 4648), l'encodage qu'attendent les applications
 * d'authentification pour le secret partagé.
 *
 * Écrit ici plutôt qu'emprunté : les bibliothèques disponibles n'existent
 * qu'en modules ECMAScript, que l'exécuteur de tests du projet ne sait pas
 * charger, et le contournement dépendait de l'ordre dans lequel npm range
 * `node_modules` — une chaîne d'intégration qui casse un jour sans que rien
 * n'ait changé dans le code.
 *
 * Vérifié sur les vecteurs publiés de la RFC 4648.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encoderBase32(octets: Buffer): string {
  let accumulateur = 0;
  let bits = 0;
  let sortie = '';

  for (const octet of octets) {
    accumulateur = (accumulateur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET[(accumulateur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  // Les bits restants forment un dernier caractère, complété par des zéros.
  if (bits > 0) {
    sortie += ALPHABET[(accumulateur << (5 - bits)) & 31];
  }
  // Le remplissage porte la longueur à un multiple de huit caractères.
  while (sortie.length % 8 !== 0) sortie += '=';

  return sortie;
}

export function decoderBase32(texte: string): Buffer {
  const propre = texte.toUpperCase().replace(/[\s=]/g, '');
  let accumulateur = 0;
  let bits = 0;
  const octets: number[] = [];

  for (const caractere of propre) {
    const valeur = ALPHABET.indexOf(caractere);
    if (valeur < 0) {
      throw new Error(`Caractère hors alphabet base32 : ${caractere}`);
    }
    accumulateur = (accumulateur << 5) | valeur;
    bits += 5;
    if (bits >= 8) {
      octets.push((accumulateur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(octets);
}
