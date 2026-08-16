/*
 * Affichage des dates.
 *
 * Les dates arrivent du serveur en ISO 8601, souvent avec une heure à minuit
 * UTC. Elles désignent pourtant un jour du calendrier, pas un instant : on lit
 * donc les dix premiers caractères plutôt que de construire une Date, ce qui
 * éviterait mal un décalage d'un jour selon le fuseau du lecteur.
 */

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

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

interface Jour {
  annee: number
  mois: number
  jour: number
}

function lireJour(isoDate: string): Jour | null {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!correspondance) return null
  return {
    annee: Number(correspondance[1]),
    mois: Number(correspondance[2]) - 1,
    jour: Number(correspondance[3]),
  }
}

/** Clé « AAAA-MM-JJ », pour regrouper ou comparer des jours entre eux. */
export function toDayKey(isoDate: string): string {
  return isoDate.slice(0, 10)
}

/** « 14 août 2026 ». L'année est omise lorsqu'il s'agit de l'année en cours. */
export function formatDate(isoDate: string): string {
  const j = lireJour(isoDate)
  if (!j) return isoDate
  const anneeCourante = new Date().getFullYear()
  const annee = j.annee === anneeCourante ? '' : ` ${j.annee}`
  return `${j.jour} ${MOIS[j.mois]}${annee}`
}

/** « jeudi 14 août 2026 », quand la date mérite d'être lue en entier. */
export function formatDayLong(isoDate: string): string {
  const j = lireJour(isoDate)
  if (!j) return isoDate
  const nomJour = JOURS[new Date(j.annee, j.mois, j.jour).getDay()]
  return `${nomJour} ${formatDate(isoDate)}`
}

/** Nombre de jours pleins entre aujourd'hui et la date, négatif si dépassée. */
export function daysUntil(isoDate: string, maintenant = new Date()): number | null {
  const j = lireJour(isoDate)
  if (!j) return null
  const cible = new Date(j.annee, j.mois, j.jour).getTime()
  const aujourdhui = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate(),
  ).getTime()
  return Math.round((cible - aujourdhui) / 86_400_000)
}

/**
 * Distance au jour présent, en français courant : « dans 4 jours »,
 * « demain », « en retard de 2 jours ». C'est l'information que l'on cherche
 * réellement en lisant une échéance — plus que la date elle-même.
 */
export function formatRelative(isoDate: string, maintenant = new Date()): string {
  const jours = daysUntil(isoDate, maintenant)
  if (jours === null) return ''

  if (jours === 0) return "aujourd'hui"
  if (jours === 1) return 'demain'
  if (jours === -1) return 'hier'

  if (jours < 0) {
    const retard = -jours
    if (retard < 31) return `en retard de ${retard} jours`
    const mois = Math.round(retard / 30)
    return mois < 12
      ? `en retard de ${mois} mois`
      : `en retard de plus d'un an`
  }

  if (jours < 31) return `dans ${jours} jours`
  const mois = Math.round(jours / 30)
  if (mois < 12) return `dans ${mois} mois`
  const annees = Math.round(jours / 365)
  return annees <= 1 ? 'dans un an' : `dans ${annees} ans`
}
