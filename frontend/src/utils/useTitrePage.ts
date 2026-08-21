import { useEffect } from 'react'

/**
 * Titre, description et adresse de référence de la page courante.
 *
 * L'application est une page unique : sans cela, toutes les adresses
 * partagent le même titre « SYNeco » — dans l'onglet du navigateur, dans les
 * favoris, et dans les résultats de recherche, où chaque page publique doit
 * annoncer ce qu'elle contient.
 *
 * L'adresse de référence (`rel="canonical"`) compte tout autant, et c'est
 * elle qu'on oublie. Le fichier HTML en pose une, en dur, vers la racine du
 * site. Faute d'être mise à jour, chaque page — conditions de vente,
 * confidentialité, mentions légales — annonçait donc aux moteurs de recherche
 * qu'elle n'était qu'un double de la page d'accueil, et se retirait d'elle-même
 * des résultats. Le plan du site demandait pendant ce temps de les indexer :
 * les deux se contredisaient, et c'est cette balise qui l'emporte.
 *
 * Titre, description et adresse d'origine sont rétablis au démontage, pour
 * qu'une page n'en laisse pas une autre parler à sa place.
 */
export function useTitrePage(titre: string, description?: string) {
  useEffect(() => {
    const titrePrecedent = document.title
    document.title = titre

    const balise = document.querySelector('meta[name="description"]')
    const descriptionPrecedente = balise?.getAttribute('content') ?? null
    if (description && balise) balise.setAttribute('content', description)

    /*
     * L'adresse déclarée est celle du chemin courant, sans paramètre de
     * requête ni ancre : « /documents?categorie=maison » et « /documents »
     * montrent la même page, et deux adresses de référence différentes pour
     * un même contenu recréeraient le doublon qu'on cherche à éviter.
     *
     * Le domaine est repris de la balise existante plutôt que codé en dur :
     * les déploiements de prévisualisation vivent sur un autre domaine, et
     * il ne faut pas qu'ils se déclarent comme référence du site public.
     */
    const canonique = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const canoniquePrecedente = canonique?.getAttribute('href') ?? null
    if (canonique && canoniquePrecedente) {
      try {
        const base = new URL(canoniquePrecedente)
        canonique.setAttribute('href', new URL(window.location.pathname, base).href)
      } catch {
        // Adresse d'origine illisible : mieux vaut la laisser telle quelle
        // que poser une référence fausse.
      }
    }

    return () => {
      document.title = titrePrecedent
      if (description && balise && descriptionPrecedente !== null) {
        balise.setAttribute('content', descriptionPrecedente)
      }
      if (canonique && canoniquePrecedente !== null) {
        canonique.setAttribute('href', canoniquePrecedente)
      }
    }
  }, [titre, description])
}
