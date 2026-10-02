import { PHOTO_COTE_MAX, IMAGE_TAILLE_MAX } from '../shared/protocol.ts';

/**
 * Prépare la photo choisie avant l'envoi : réduite à PHOTO_COTE_MAX px et
 * ré-encodée en JPEG. Le ré-encodage efface aussi les métadonnées (EXIF),
 * dont la position GPS de la prise de vue.
 */
export async function preparerPhoto(fichier: File): Promise<string> {
  if (!fichier.type.startsWith('image/')) throw new Error('Ce fichier n’est pas une photo.');
  const url = URL.createObjectURL(fichier);
  try {
    const image = await new Promise<HTMLImageElement>((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ko(new Error('Impossible de lire cette photo.'));
      img.src = url;
    });
    // Le navigateur applique déjà l'orientation EXIF à l'affichage d'une <img>.
    for (const [cote, qualite] of [
      [PHOTO_COTE_MAX, 0.8],
      [1024, 0.7],
      [800, 0.6],
    ] as const) {
      const echelle = Math.min(1, cote / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * echelle);
      canvas.height = Math.round(image.naturalHeight * echelle);
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      const donnees = canvas.toDataURL('image/jpeg', qualite);
      if (donnees.length <= IMAGE_TAILLE_MAX) return donnees;
    }
    throw new Error('Photo trop lourde, choisis-en une autre.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
