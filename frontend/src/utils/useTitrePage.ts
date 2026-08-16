import { useEffect } from 'react'

/**
 * Titre et description de la page courante.
 *
 * L'application est une page unique : sans cela, toutes les adresses
 * partagent le même titre « SYNeco » — dans l'onglet du navigateur, dans les
 * favoris, et dans les résultats de recherche, où chaque page publique doit
 * annoncer ce qu'elle contient.
 *
 * La description d'origine est rétablie au démontage, pour qu'une page n'en
 * laisse pas une autre parler à sa place.
 */
export function useTitrePage(titre: string, description?: string) {
  useEffect(() => {
    const titrePrecedent = document.title
    document.title = titre

    const balise = document.querySelector('meta[name="description"]')
    const descriptionPrecedente = balise?.getAttribute('content') ?? null
    if (description && balise) balise.setAttribute('content', description)

    return () => {
      document.title = titrePrecedent
      if (description && balise && descriptionPrecedente !== null) {
        balise.setAttribute('content', descriptionPrecedente)
      }
    }
  }, [titre, description])
}
