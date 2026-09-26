/**
 * Où joindre le serveur de jeu.
 *
 * Sur le site, la page est servie par le serveur de jeu lui-même : on garde la
 * même adresse. Dans l'application installée (Capacitor), la page est locale au
 * téléphone : l'adresse du serveur est fixée à la construction par
 * `VITE_SERVER_URL` (voir `npm run build:app`).
 */
const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '');

/** Adresse publique du jeu, utilisée aussi pour les liens d'invitation. */
export const PUBLIC_ORIGIN = configured || (typeof location === 'undefined' ? '' : location.origin);

export function websocketUrl(path: string): string {
  const url = new URL(path, PUBLIC_ORIGIN);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
