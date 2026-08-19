import { Logger } from '@nestjs/common';

/*
 * Ce que Brevo envoie quand un courriel arrive, et comment en tirer les
 * pièces jointes.
 *
 * Le service de réception est isolé dans ce seul fichier : il se remplace
 * sans toucher au traitement, et le jour où l'on change de prestataire, il
 * n'y a que cette forme-là à réécrire.
 *
 * Le contenu des pièces jointes ne voyage pas dans le webhook — seulement un
 * jeton de téléchargement, à échanger contre le fichier.
 */

const API = 'https://api.brevo.com/v3';

export interface PieceJointeBrevo {
  Name?: string;
  ContentType?: string;
  ContentLength?: number;
  DownloadToken?: string;
}

export interface CourrielBrevo {
  Uuid?: string[];
  From?: { Address?: string; Name?: string };
  To?: { Address?: string; Name?: string }[];
  Subject?: string;
  Attachments?: PieceJointeBrevo[];
}

export interface ChargeBrevo {
  items?: CourrielBrevo[];
}

export function receptionConfiguree(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

/**
 * Échange un jeton de téléchargement contre le contenu du fichier.
 *
 * Rend null plutôt que de lever : une pièce jointe illisible ne doit pas
 * faire échouer le message entier, qui en porte peut-être d'autres.
 */
export async function telechargerPieceJointe(
  jeton: string,
  journal: Logger,
): Promise<Buffer | null> {
  const cle = process.env.BREVO_API_KEY;
  if (!cle) return null;

  try {
    const reponse = await fetch(`${API}/inbound/attachments/${jeton}`, {
      headers: { 'api-key': cle, accept: 'application/octet-stream' },
    });
    if (!reponse.ok) {
      journal.warn(
        `Pièce jointe non récupérée (${reponse.status} ${reponse.statusText})`,
      );
      return null;
    }
    return Buffer.from(await reponse.arrayBuffer());
  } catch (err) {
    journal.warn(`Pièce jointe non récupérée : ${(err as Error).message}`);
    return null;
  }
}
