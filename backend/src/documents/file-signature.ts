/*
 * Vérification du type réel d'un fichier déposé.
 *
 * Le type annoncé dans la requête vient du client : il se change en une
 * ligne. Un exécutable renommé « facture.pdf » et déclaré
 * « application/pdf » passait donc le contrôle, était stocké, puis servi
 * plus tard sous ce type — ce qui est exactement la manière dont un
 * fichier hostile voyage.
 *
 * On lit donc les premiers octets, qui, eux, ne mentent pas. Ces signatures
 * sont normalisées et stables depuis des décennies.
 */

/** Types acceptés, et la signature qui les identifie réellement. */
const SIGNATURES: { mime: string; octets: number[]; decalage?: number }[] = [
  // %PDF
  { mime: 'application/pdf', octets: [0x25, 0x50, 0x44, 0x46] },
  // JPEG : marqueur de début d'image
  { mime: 'image/jpeg', octets: [0xff, 0xd8, 0xff] },
  // PNG : signature à huit octets
  {
    mime: 'image/png',
    octets: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  // WEBP : conteneur RIFF, puis « WEBP » au huitième octet
  { mime: 'image/webp', octets: [0x52, 0x49, 0x46, 0x46] },
];

function commencePar(contenu: Buffer, octets: number[], decalage = 0): boolean {
  if (contenu.length < decalage + octets.length) return false;
  return octets.every((octet, i) => contenu[decalage + i] === octet);
}

/**
 * Type réellement porté par le contenu, ou null s'il n'est pas reconnu.
 *
 * Renvoyer null plutôt que de deviner : un fichier dont on ne sait pas
 * dire ce qu'il est n'a pas sa place dans un coffre à documents.
 */
export function typeReel(contenu: Buffer): string | null {
  for (const { mime, octets, decalage } of SIGNATURES) {
    if (!commencePar(contenu, octets, decalage)) continue;
    // Un conteneur RIFF peut porter autre chose qu'une image : on exige la
    // marque WEBP, faute de quoi un fichier audio passerait pour une image.
    if (
      mime === 'image/webp' &&
      !commencePar(contenu, [0x57, 0x45, 0x42, 0x50], 8)
    ) {
      continue;
    }
    return mime;
  }
  return null;
}
