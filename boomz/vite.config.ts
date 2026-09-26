import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // En développement, Vite sert les pages et relaie les connexions au serveur de jeu.
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } },
  },
});
