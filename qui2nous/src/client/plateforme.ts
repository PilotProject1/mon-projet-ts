import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

// Ce qui change entre le site web et l'app iPhone (Capacitor).
// Sur le site, l'interface et le serveur de jeu ont la même adresse. Dans
// l'app, l'interface est embarquée et le serveur est en ligne : son adresse
// est fixée à la compilation (VITE_URL_SERVEUR, voir APP-STORE.md).

export const estAppli = Capacitor.isNativePlatform();

/** Adresse du serveur de jeu, sans barre finale ; vide sur le site (même adresse). */
export const SERVEUR = (import.meta.env.VITE_URL_SERVEUR ?? '').replace(/\/$/, '');

/** Adresse complète d'une ressource du serveur (images des manches). */
export const urlServeur = (chemin: string) => `${SERVEUR}${chemin}`;

/** Lien d'invitation : toujours l'adresse publique du site, même depuis l'app. */
export function lienInvitation(code: string) {
  const base = SERVEUR || location.origin;
  return `${base}/?code=${code}`;
}

/** Vibration : moteur haptique natif dans l'app, API web ailleurs (Android). */
export function vibrer(ms: number) {
  if (estAppli) {
    Haptics.impact({ style: ms >= 100 ? ImpactStyle.Heavy : ImpactStyle.Medium }).catch(() => {});
    return;
  }
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* pas de vibreur : tant pis */
  }
}

/** Feuille de partage : native dans l'app, Web Share ou presse-papiers sur le site. Renvoie true si le lien a été copié. */
export async function partager(titre: string, texte: string, url: string): Promise<boolean> {
  if (estAppli) {
    await Share.share({ title: titre, text: texte, url, dialogTitle: titre }).catch(() => {});
    return false;
  }
  if (navigator.share) {
    await navigator.share({ title: titre, text: texte, url }).catch(() => {});
    return false;
  }
  await navigator.clipboard?.writeText(url);
  return true;
}
