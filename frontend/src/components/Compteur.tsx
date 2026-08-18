import { useEffect, useRef, useState } from 'react'

/*
 * Un nombre qui monte jusqu'à sa valeur.
 *
 * Ce n'est pas de l'ornement : un chiffre qui grimpe se remarque, et sur un
 * tableau de bord c'est exactement ce qu'on veut — que l'œil aille au compte
 * plutôt qu'au cadre qui l'entoure.
 *
 * Deux précautions, sans lesquelles l'effet devient une gêne :
 *  - qui a demandé moins de mouvement voit la valeur d'emblée ;
 *  - au-delà d'un certain compte, on n'égrène pas les unités : la durée est
 *    fixe et c'est le pas qui s'adapte, sinon 300 documents mettraient
 *    dix secondes à s'afficher.
 */

const DUREE = 900

export default function Compteur({ valeur }: { valeur: number }) {
  const [affiche, setAffiche] = useState(valeur)
  const precedent = useRef(valeur)

  useEffect(() => {
    const depart = precedent.current
    precedent.current = valeur

    const mouvementRefuse =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (mouvementRefuse || depart === valeur) {
      setAffiche(valeur)
      return
    }

    let image = 0
    const debut = performance.now()

    const avancer = (maintenant: number) => {
      const part = Math.min(1, (maintenant - debut) / DUREE)
      // Décélération : le compte ralentit en approchant, ce qui donne
      // l'impression qu'il se pose au lieu de s'arrêter net.
      const adouci = 1 - Math.pow(1 - part, 3)
      setAffiche(Math.round(depart + (valeur - depart) * adouci))
      if (part < 1) image = requestAnimationFrame(avancer)
    }

    image = requestAnimationFrame(avancer)
    return () => cancelAnimationFrame(image)
  }, [valeur])

  return <>{affiche}</>
}
