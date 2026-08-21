import { Analytics } from '@vercel/analytics/react'

/*
 * Mesure d'audience.
 *
 * Savoir combien de visiteurs arrivent, et où ils renoncent. Sans cela, on
 * corrige une page d'accueil à l'aveugle.
 *
 * L'outil retenu ne pose aucun cookie : il dérive un identifiant de la requête
 * elle-même, le jette au bout de vingt-quatre heures, et ne conserve que des
 * totaux. C'est ce qui permet de mesurer sans bannière de consentement — une
 * exemption étroite, qui vaut pour la mesure d'audience seule et se perdrait
 * au premier outil publicitaire ajouté à côté.
 *
 * Ce qu'il ne verra jamais :
 *
 *  - Les adresses de partage. Elles portent le jeton secret qui donne accès au
 *    document, en clair dans le chemin. L'envoyer à un tiers reviendrait à lui
 *    confier la clé, et un journal de mesure se conserve longtemps.
 *  - Les paramètres de requête, retirés systématiquement. Aucun ne nous
 *    apprend rien qu'on ne sache déjà, et c'est par là que les secrets
 *    s'échappent le jour où l'on ajoute une adresse sans y penser.
 *
 * Le filtre écarte par défaut : une adresse inattendue est ignorée plutôt que
 * transmise. Une mesure incomplète se rattrape, un secret parti ne revient pas.
 */

/** Chemins publics et pages de l'application dont l'adresse ne dit rien de privé. */
const CHEMINS_MESURABLES = [
  '/',
  '/connexion',
  '/inscription',
  '/mentions-legales',
  '/confidentialite',
  '/cgv',
  '/documents',
  '/echeances',
  '/contrats',
  '/partages',
  '/recherche',
  '/entreprise',
  '/clients',
  '/factures',
  '/abonnement',
  '/securite',
  '/partage-recu',
  '/administration',
]

export default function Mesure() {
  return (
    <Analytics
      beforeSend={(evenement) => {
        let adresse: URL
        try {
          // Base de repli : l'outil transmet aujourd'hui une adresse absolue,
          // mais rien dans son contrat ne le garantit, et un chemin nu ferait
          // lever ce constructeur — donc taire toute mesure.
          adresse = new URL(evenement.url, window.location.origin)
        } catch {
          return null
        }

        if (!CHEMINS_MESURABLES.includes(adresse.pathname)) return null

        /*
         * Requête et ancre retirées, mais l'adresse reste entière.
         *
         * Renvoyer le seul chemin semblait plus propre ; c'était une erreur.
         * L'outil attend une adresse complète — il en construit lui-même une
         * quand il veut réécrire le chemin — et un envoi mal formé est rejeté
         * sans un mot, la requête étant enveloppée dans un catch muet. Rien
         * n'était mesuré, et rien ne le disait.
         */
        adresse.search = ''
        adresse.hash = ''
        return { ...evenement, url: adresse.href }
      }}
    />
  )
}
