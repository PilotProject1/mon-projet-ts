import { useEffect, useState } from 'react'

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
 *
 * L'élément est suivi par une fonction de référence plutôt que par un
 * `useRef`. La différence n'est pas de style : un appelant qui ne rend son
 * contenu qu'une fois ses données arrivées — donc `null` au premier rendu —
 * attachait la référence trop tard pour un effet monté une seule fois.
 * L'observateur n'était alors jamais posé, et comme les règles de mouvement
 * mettent les éléments à `opacity: 0` en les attendant, le bloc restait
 * invisible pour de bon. Ici, l'effet se rejoue à l'instant où le nœud
 * apparaît, quel que soit le rendu où cela arrive.
 */
export function useApparition<T extends HTMLElement>(
  classes: { arme: string; visible: string } = {
    arme: 'atout-anime',
    visible: 'est-visible',
  },
) {
  const [element, setElement] = useState<T | null>(null)
  const [anime, setAnime] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
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
  }, [element])

  return {
    // Stable d'un rendu à l'autre (c'est le poseur d'état de useState) : React
    // ne rappelle donc pas la fonction à chaque rendu.
    ref: setElement,
    classe: `${anime ? classes.arme : ''} ${visible ? classes.visible : ''}`.trim(),
  }
}

/**
 * Même mécanique, pour l'intérieur de l'application.
 *
 * Les noms de classes diffèrent de ceux de la page d'accueil parce que les
 * deux mouvements n'ont pas le même propos : là-bas des illustrations se
 * dessinent, ici des listes et des cartes se posent. Mêler les deux
 * reviendrait à ce qu'un réglage fait pour l'un déplace l'autre sans qu'on
 * s'en aperçoive.
 */
export function useEntree<T extends HTMLElement>() {
  return useApparition<T>({ arme: 'mvt', visible: 'mvt-entre' })
}
