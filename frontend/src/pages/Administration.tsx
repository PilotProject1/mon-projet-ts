import { useEffect, useState } from 'react'
import { ApiError, adminApi } from '../services/api'
import type { StatistiquesAdmin } from '../types'
import { useTitrePage } from '../utils/useTitrePage'

/*
 * Suivi du service, réservé à l'éditeur.
 *
 * Des compteurs, et rien d'autre : aucune adresse, aucun nom, aucun titre de
 * document. L'éditeur y a droit comme responsable de traitement, mais un
 * écran qui déballe les données de ses clients contredirait ce que la
 * politique de confidentialité leur promet.
 */

const LIBELLES_PLANS: Record<string, string> = {
  gratuit: 'Gratuit',
  premium: 'Premium',
  pro: 'Professionnel',
  pme: 'PME',
}

const JOUR_COURT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
})

function Chiffre({
  valeur,
  libelle,
  precision,
}: {
  valeur: number
  libelle: string
  precision?: string
}) {
  return (
    <div className="brand-card-shadow rounded-[14px] border border-brand-border bg-white px-5 py-4">
      <p className="text-xs font-medium text-brand-muted">{libelle}</p>
      <p className="font-heading mt-1 text-[26px] leading-none font-bold text-brand-deep">
        {valeur}
      </p>
      {precision && <p className="mt-1 text-xs text-brand-muted">{precision}</p>}
    </div>
  )
}

export default function Administration() {
  useTitrePage('Suivi — SYNeco')
  const [stats, setStats] = useState<StatistiquesAdmin | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    adminApi
      .statistiques()
      .then(setStats)
      .catch((err) =>
        setErreur(
          err instanceof ApiError ? err.message : 'Impossible de charger le suivi',
        ),
      )
  }, [])

  if (erreur) {
    return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
  }
  if (!stats) {
    return <p className="text-sm text-brand-muted">Chargement…</p>
  }

  const payants = Object.entries(stats.plans)
    .filter(([plan]) => plan !== 'gratuit')
    .reduce((total, [, nombre]) => total + nombre, 0)

  // L'échelle se règle sur le jour le plus chargé : une hauteur fixe
  // écraserait la courbe dès la première journée un peu forte.
  const sommet = Math.max(1, ...stats.inscriptionsParJour.map((j) => j.nombre))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-brand-deep">Suivi</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Des compteurs uniquement : aucune donnée personnelle n'est affichée ici.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre
          valeur={stats.comptes.aujourdhui}
          libelle="Inscriptions aujourd’hui"
          precision={`${stats.comptes.septDerniersJours} sur 7 jours`}
        />
        <Chiffre
          valeur={stats.comptes.total}
          libelle="Comptes au total"
          precision={payants > 0 ? `dont ${payants} payant${payants > 1 ? 's' : ''}` : 'aucun payant'}
        />
        <Chiffre
          valeur={stats.documents.total}
          libelle="Documents déposés"
          precision={`${stats.documents.aujourdhui} aujourd’hui`}
        />
        <Chiffre
          valeur={stats.echeances.aFaire}
          libelle="Échéances à faire"
          precision={`${stats.echeances.total} au total`}
        />
      </div>

      <div className="brand-card-shadow mb-6 rounded-[14px] border border-brand-border bg-white px-5 py-5">
        <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
          Inscriptions des 14 derniers jours
        </h2>
        {/* Les barres partagent la largeur disponible : sur téléphone comme
            sur ordinateur, la courbe tient sans défilement latéral. */}
        <div className="mt-4 flex h-24 items-end gap-1">
          {stats.inscriptionsParJour.map(({ jour, nombre }) => (
            <div key={jour} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-brand-muted">
                {nombre > 0 ? nombre : ''}
              </span>
              <div
                className="w-full rounded-t bg-brand-green"
                style={{ height: `${Math.max(2, (nombre / sommet) * 64)}px` }}
                title={`${nombre} le ${jour}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-brand-muted">
          <span>{JOUR_COURT.format(new Date(stats.inscriptionsParJour[0].jour))}</span>
          <span>
            {JOUR_COURT.format(
              new Date(stats.inscriptionsParJour[stats.inscriptionsParJour.length - 1].jour),
            )}
          </span>
        </div>
      </div>

      <div className="brand-card-shadow rounded-[14px] border border-brand-border bg-white px-5 py-5">
        <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
          Répartition des offres
        </h2>
        <ul className="mt-3 space-y-2">
          {Object.entries(LIBELLES_PLANS).map(([plan, libelle]) => {
            const nombre = stats.plans[plan] ?? 0
            const part = stats.comptes.total > 0 ? (nombre / stats.comptes.total) * 100 : 0
            return (
              <li key={plan} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-brand-ink">{libelle}</span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-border">
                  <span
                    className="block h-full rounded-full bg-brand-green"
                    style={{ width: `${part}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right font-medium text-brand-deep">
                  {nombre}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-brand-muted">
          {stats.documents.analyses} document{stats.documents.analyses > 1 ? 's' : ''} lu
          {stats.documents.analyses > 1 ? 's' : ''} par la reconnaissance automatique.
        </p>
      </div>
    </div>
  )
}
