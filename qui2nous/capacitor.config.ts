import type { CapacitorConfig } from '@capacitor/cli';

// App iPhone de Qui2Nous : l'interface compilée (dist/) est embarquée dans
// l'app, qui se connecte au serveur de jeu en ligne (VITE_URL_SERVEUR).
const config: CapacitorConfig = {
  appId: 'fr.qui2nous.jeu',
  appName: 'Qui2Nous',
  webDir: 'dist',
  backgroundColor: '#c026d3',
  ios: {
    contentInset: 'never',
    backgroundColor: '#c026d3',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#c026d3',
      showSpinner: false,
    },
  },
};

export default config;
