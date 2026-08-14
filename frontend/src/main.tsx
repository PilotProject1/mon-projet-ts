import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// L'enregistrement du service worker rend l'application installable. Il est
// volontairement fait après le rendu et hors du chemin critique : un échec
// (navigateur ancien, contexte non sécurisé) ne doit pas empêcher le site de
// fonctionner. En développement, Vite sert les modules sans empreinte : le
// cache n'aurait aucun sens et masquerait les modifications en cours.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* installation impossible : l'application reste utilisable en ligne */
    })
  })
}
