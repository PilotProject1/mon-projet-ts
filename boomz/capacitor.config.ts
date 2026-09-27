import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Application installée (Android, iOS) : elle embarque le jeu compilé (`dist/`)
 * et se connecte au serveur en ligne (voir `npm run build:app`).
 *
 * `appId` est l'identifiant définitif de l'application sur les stores : il ne
 * pourra plus changer une fois l'application publiée.
 */
const config: CapacitorConfig = {
  appId: 'fr.boomz.jeu',
  appName: 'Boomz',
  webDir: 'dist',
  backgroundColor: '#120e0d',
  android: {
    // Pas de contenu mixte : le serveur de jeu est en HTTPS.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
};

export default config;
