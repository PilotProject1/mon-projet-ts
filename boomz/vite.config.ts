import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        online: resolve(import.meta.dirname, 'index.html'),
        local: resolve(import.meta.dirname, 'local.html'),
      },
    },
  },
  server: {
    // En développement, Vite sert les pages et relaie les connexions au serveur de jeu.
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } },
  },
});
