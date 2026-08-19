import type { Deadline, Document } from '../types'

/*
 * Les questions proposées sous le champ de recherche.
 *
 * Elles sont tirées des documents de la personne, pas d'une liste figée :
 * « Combien ai-je payé à EDF cette année ? » n'a d'intérêt que si elle a
 * effectivement des factures EDF. Une suggestion générique se voit tout de
 * suite, ne fonctionne pas, et apprend surtout que la recherche ne sait rien
 * faire.
 *
 * Elles ont un second rôle, plus important que de faire gagner une frappe :
 * personne ne devine ce qu'une recherche en langage naturel accepte. Montrer
 * quatre questions qui marchent enseigne la forme des questions possibles.
 *
 * L'ordre va du plus concret au plus général, et on s'arrête à quatre : une
 * liste plus longue redevient un formulaire à lire.
 */

const NOMBRE_MAX = 4

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** L'émetteur qui revient le plus souvent, et donc celui qui parlera le plus. */
function emetteurLePlusFrequent(documents: Document[]): string | null {
  const comptes = new Map<string, number>()
  for (const doc of documents) {
    if (!doc.provider) continue
    comptes.set(doc.provider, (comptes.get(doc.provider) ?? 0) + 1)
  }
  let meilleur: string | null = null
  let record = 0
  for (const [emetteur, nombre] of comptes) {
    if (nombre > record) {
      meilleur = emetteur
      record = nombre
    }
  }
  return meilleur
}

export function suggestionsRecherche(
  documents: Document[],
  deadlines: Deadline[],
): string[] {
  const suggestions: string[] = []
  const maintenant = new Date()
  const annee = maintenant.getFullYear()

  const emetteur = emetteurLePlusFrequent(documents)
  if (emetteur) {
    suggestions.push(`Combien ai-je payé à ${emetteur} cette année ?`)
  }

  if (deadlines.some((d) => d.status === 'a_faire')) {
    suggestions.push('Qu’est-ce qui arrive à échéance le mois prochain ?')
  }

  if (documents.some((d) => typeof d.amount === 'number' && d.amount > 100)) {
    suggestions.push(`Mes factures de plus de 100 € en ${annee}`)
  }

  if (documents.some((d) => d.type === 'assurance' || d.type === 'contrat')) {
    suggestions.push('Quels contrats et assurances ai-je en cours ?')
  }

  if (documents.some((d) => d.paid === false)) {
    suggestions.push('Quelles factures me restent à payer ?')
  }

  /*
   * Compte neuf, ou documents pas encore lus : on propose quand même de quoi
   * essayer. Ces questions ne trouveront rien, et c'est acceptable — la page
   * doit montrer ce qu'on peut demander avant d'avoir de quoi le demander.
   */
  if (suggestions.length === 0) {
    const mois = MOIS[maintenant.getMonth()]
    return [
      'Quels documents ai-je ajoutés ce mois-ci ?',
      `Mes factures de ${mois}`,
      'Quelles échéances arrivent bientôt ?',
      'Quels contrats ai-je en cours ?',
    ]
  }

  return suggestions.slice(0, NOMBRE_MAX)
}
