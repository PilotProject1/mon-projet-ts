import { useEffect, useRef, useState } from 'react'

/**
 * Signale qu'un élément est entré dans l'écran, une seule fois.
 *
 * Une animation qui se rejoue à chaque passage devient un tic : on observe
 * donc jusqu'à la première apparition, puis on cesse. Le seuil est bas et la
 * marge négative en bas de l'écran, pour que le mouvement démarre quand la
 * case est réellement regardée, pas au moment où son premier pixel affleure.
 *
 * Deux cas font renoncer au mouvement, et l'illustration s'affiche alors
 * d'emblée dans son état final :
 *  - le visiteur a demandé à réduire les animations dans son système ;
 *  - le navigateur ne connaît pas IntersectionObserver.
 */
export function useApparition<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [anime, setAnime] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const mouvementRefuse =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (mouvementRefuse || typeof IntersectionObserver === 'undefined') return

    // Marqué animable seulement ici : sans JavaScript ni observateur, le
    // dessin reste visible au lieu de rester à jamais transparent.
    setAnime(true)

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue
          setVisible(true)
          observateur.disconnect()
        }
      },
      { threshold: 0.25, rootMargin: '0px 0px -10% 0px' },
    )

    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])

  return { ref, classe: `${anime ? 'atout-anime' : ''} ${visible ? 'est-visible' : ''}`.trim() }
}
