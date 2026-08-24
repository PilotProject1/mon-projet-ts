import type { Document, Urgence } from '../types'

/*
 * Le geste qu'un document appelle, quand il y en a un.
 *
 * Dans le même esprit que `categorise()` côté serveur : mieux vaut ne rien
 * proposer qu'inventer une action à partir d'un champ absent. Chaque règle ne
 * s'appuie que sur ce que la lecture du document a déjà établi — aucune ne
 * déclenche de nouvel appel.
 */

export interface ActionProposee {
  kind: string
  urgence: Urgence
  message: string
  actionLabel: string
  /** Une route interne (commence par `/`) ou un lien `mailto:`. */
  actionTo: string
}

function formatDateCourrier(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Lien `mailto:` pré-rempli, à relire avant envoi — jamais expédié seul. */
function lienResiliation(document: Document): string {
  const objet = `Résiliation${document.reference ? ` — réf. ${document.reference}` : ''}`
  const lignesRef = document.reference ? `Référence du contrat : ${document.reference}\n` : ''
  const lignesDate = document.documentDate
    ? `Document daté du ${formatDateCourrier(document.documentDate)}\n`
    : ''
  const corps =
    `Madame, Monsieur,\n\n` +
    `Je vous informe par la présente de ma décision de résilier le contrat me liant à ` +
    `${document.provider ?? 'votre organisme'}.\n\n` +
    lignesRef +
    lignesDate +
    `\nJe vous remercie de bien vouloir m'en confirmer la prise en compte, ainsi que la date ` +
    `d'effet de cette résiliation.\n\nCordialement,`
  return `mailto:?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`
}

/**
 * 0 à 2 actions dérivées d'un document déjà analysé.
 *
 * Les échéances (repérées, dépassées, proches) sont déjà couvertes ailleurs
 * (`SuggestedDeadline`, le Briefing) : ces règles ne les répètent pas, elles
 * couvrent ce que ces deux blocs ne disent pas — comparer, résilier.
 */
export function proposerActions(document: Document): ActionProposee[] {
  const actions: ActionProposee[] = []

  if (document.type === 'facture' && document.provider && document.amount !== null) {
    actions.push({
      kind: 'comparer',
      urgence: 'information',
      message: `Comparer cette facture à vos autres factures ${document.provider}.`,
      actionLabel: 'Voir le tableau de bord',
      actionTo: '/',
    })
  }

  if ((document.type === 'contrat' || document.type === 'assurance') && document.provider) {
    actions.push({
      kind: 'resilier',
      urgence: 'information',
      message: `Envoyer une résiliation à ${document.provider}.`,
      actionLabel: 'Préparer le courrier',
      actionTo: lienResiliation(document),
    })
  }

  return actions
}
