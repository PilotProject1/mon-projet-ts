import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { PlanCatalogueEntry, PlanFeature, PlanUsage } from '../types'
import { ApiError, billingApi, planApi } from '../services/api'

interface AbonnementProps {
  planUsage: PlanUsage | null
  onPlanChanged: () => Promise<void>
}

const featureLabels: Record<PlanFeature, string> = {
  ia: 'Assistant IA : extraction et recherche',
  partage: 'Partage sécurisé de documents',
  facturation: 'Facturation, clients et entreprise',
  equipes: 'Plusieurs utilisateurs et droits d’accès',
}

function formatPrice(euros: number) {
  return euros === 0 ? 'Gratuit' : `${euros.toFixed(2).replace('.', ',')} €/mois`
}

export default function Abonnement({ planUsage, onPlanChanged }: AbonnementProps) {
  const [catalogue, setCatalogue] = useState<PlanCatalogueEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const paiement = searchParams.get('paiement')

  useEffect(() => {
    planApi
      .catalogue()
      .then((res) => setCatalogue(res.plans))
      .catch(() => setError("Impossible de charger les offres"))
  }, [])

  // Au retour de Stripe, le plan a pu changer entre-temps : on le relit.
  // Le webhook fait foi, cette relecture ne sert qu'à rafraîchir l'affichage.
  useEffect(() => {
    if (paiement === 'succes') {
      onPlanChanged().catch(() => undefined)
    }
  }, [paiement, onPlanChanged])

  async function handleSubscribe(plan: 'premium' | 'pro') {
    setError(null)
    setPendingPlan(plan)
    try {
      const { url } = await billingApi.checkout(plan)
      window.location.href = url
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible d’ouvrir le paiement')
      setPendingPlan(null)
    }
  }

  async function handlePortal() {
    setError(null)
    setPendingPlan('portal')
    try {
      const { url } = await billingApi.portal()
      window.location.href = url
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible d’ouvrir le portail')
      setPendingPlan(null)
    }
  }

  const currentPlan = planUsage?.plan
  const hasPaidPlan = currentPlan && currentPlan !== 'gratuit'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-brand-deep">Abonnement</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Votre offre actuelle et les formules disponibles.
        </p>
      </div>

      {paiement === 'succes' && (
        <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Paiement confirmé. Votre nouvelle offre est active — si elle n’apparaît pas
          immédiatement, rechargez la page dans quelques secondes.
          <button
            onClick={() => setSearchParams({})}
            className="ml-2 font-medium underline"
          >
            Fermer
          </button>
        </div>
      )}
      {paiement === 'annule' && (
        <div className="mb-4 rounded-md bg-brand-mint px-3 py-2 text-sm text-brand-deep">
          Paiement abandonné. Aucun montant n’a été prélevé.
          <button
            onClick={() => setSearchParams({})}
            className="ml-2 font-medium underline"
          >
            Fermer
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {catalogue.map((entry) => {
          const isCurrent = entry.plan === currentPlan
          const quota =
            entry.maxDocuments === null
              ? 'Documents illimités'
              : `${entry.maxDocuments} documents`

          return (
            <div
              key={entry.plan}
              className={`brand-card-shadow flex flex-col rounded-lg border bg-white p-5 ${
                isCurrent ? 'border-brand-green ring-1 ring-brand-green' : 'border-brand-border'
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-base font-semibold text-brand-deep">
                    {entry.label}
                  </p>
                  <p className="text-sm text-brand-muted">{formatPrice(entry.monthlyPrice)}</p>
                </div>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-brand-green-soft px-2 py-0.5 text-xs font-medium text-brand-green-deep">
                    Offre actuelle
                  </span>
                )}
              </div>

              <ul className="mb-5 space-y-1.5">
                <li className="flex items-start gap-2 text-sm text-brand-ink">
                  <Check size={15} className="mt-0.5 shrink-0 text-brand-green" />
                  {quota}
                </li>
                {entry.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-brand-ink">
                    <Check size={15} className="mt-0.5 shrink-0 text-brand-green" />
                    {featureLabels[feature]}
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                {isCurrent ? (
                  <p className="text-center text-sm text-brand-muted">Votre offre</p>
                ) : entry.purchasable ? (
                  <button
                    onClick={() => handleSubscribe(entry.plan as 'premium' | 'pro')}
                    disabled={pendingPlan !== null}
                    className="brand-gradient w-full rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pendingPlan === entry.plan ? 'Redirection...' : `Choisir ${entry.label}`}
                  </button>
                ) : (
                  <p className="text-center text-sm text-brand-muted">
                    {entry.monthlyPrice === 0 ? 'Offre par défaut' : 'Bientôt disponible'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {hasPaidPlan && (
        <div className="brand-card-shadow mt-6 rounded-lg border border-brand-border bg-white p-5">
          <p className="mb-1 text-sm font-semibold text-brand-deep">Gérer mon abonnement</p>
          <p className="mb-3 text-sm text-brand-muted">
            Moyen de paiement, factures et résiliation.
          </p>
          <button
            onClick={handlePortal}
            disabled={pendingPlan !== null}
            className="rounded-md border border-brand-border px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-mint disabled:opacity-60"
          >
            {pendingPlan === 'portal' ? 'Redirection...' : 'Ouvrir le portail de facturation'}
          </button>
        </div>
      )}

      <p className="mt-6 text-xs text-brand-muted">
        Paiement sécurisé par Stripe. SYNeco ne conserve aucune donnée bancaire. TVA non
        applicable, article 293 B du CGI : les montants affichés sont ceux réellement prélevés.
      </p>
    </div>
  )
}
