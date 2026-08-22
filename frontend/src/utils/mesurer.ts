import { track } from '@vercel/analytics'

/*
 * Les quelques gestes qu'on veut pouvoir compter.
 *
 * Le nombre de visiteurs ne dit pas où ils renoncent. Trente personnes
 * arrivées et une seule parvenue jusqu'au formulaire peut vouloir dire deux
 * choses opposées — la promesse ne convainc pas, ou le formulaire fait peur —
 * et les deux appellent des corrections contraires. Sans ces repères, on
 * corrige au hasard.
 *
 * Ce qui est envoyé se limite au nom du geste et, pour un clic, à l'endroit
 * de la page d'où il part. Jamais d'adresse e-mail, jamais d'identifiant,
 * jamais rien qui désigne une personne : ces mesures répondent à « combien »,
 * pas à « qui ».
 *
 * Les envois passent par le même filtre que les pages consultées, celui de
 * `components/Mesure.tsx` : une mesure partie d'une adresse inattendue est
 * écartée comme le reste.
 */

/** D'où part le clic : la décision immédiate ne dit pas la même chose que celle prise après lecture. */
export type Emplacement = 'entete' | 'hero' | 'bandeau'

/** Un visiteur s'engage vers l'inscription. */
export function mesurerClicInscription(emplacement: Emplacement): void {
  try {
    track('inscription_cliquee', { emplacement })
  } catch {
    // Une mesure qui échoue ne doit jamais empêcher la navigation : le
    // visiteur passe avant le chiffre.
  }
}

/** Un compte vient d'être créé — le bout de l'entonnoir. */
export function mesurerCompteCree(): void {
  try {
    track('compte_cree')
  } catch {
    /* voir ci-dessus */
  }
}
