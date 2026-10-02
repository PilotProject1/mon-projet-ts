import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En développement, Vite sert l'interface et relaie le temps réel vers le
// serveur de jeu (npm run dev:server, port 3001).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/photo': 'http://localhost:3001',
    },
  },
});
