import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { PlanCatalogueEntry, PlanFeature, PlanUsage } from '../types'
import { ApiError, billingApi, planApi } from '../services/api'
import ExporterMesDonnees from '../components/ExporterMesDonnees'
import SupprimerCompte from '../components/SupprimerCompte'

interface AbonnementProps {
  planUsage: PlanUsage | null
  onPlanChanged: () => Promise<void>
  /** Appelé après la suppression du compte : la session n'a plus d'objet. */
  onCompteSupprime: () => void
}

const featureLabels: Record<PlanFeature, string> = {
  ia: 'Assistant IA : reconnaît n’importe quel émetteur, extraction et recherche',
  partage: 'Partage sécurisé de documents',
  facturation: 'Facturation, clients et entreprise',
  equipes: 'Plusieurs utilisateurs et droits d’accès',
}

function formatPrice(euros: number) {
  return euros === 0 ? 'Gratuit' : `${euros.toFixed(2).replace('.', ',')} €/mois`
}

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function Abonnement({
  planUsage,
  onPlanChanged,
  onCompteSupprime,
}: AbonnementProps) {
  const [catalogue, setCatalogue] = useState<PlanCatalogueEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  // Renonciation expresse au droit de rétractation, exigée pour un service
  // numérique exécuté immédiatement (art. L221-25 du Code de la consommation).
  const [renonciation, setRenonciation] = useState(false)
  // Offre choisie, en attente de confirmation. Le consentement est recueilli
  // dans cet écran plutôt que sur la page : il se rattache ainsi à une
  // commande précise — offre et prix affichés — et non à une intention vague.
  const [offreAConfirmer, setOffreAConfirmer] = useState<PlanCatalogueEntry | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const paiement = searchParams.get('paiement')
  const retourPortail = searchParams.get('retour') === 'portail'

  useEffect(() => {
    planApi
      .catalogue()
      .then((res) => setCatalogue(res.plans))
      .catch(() => setError("Impossible de charger les offres"))
  }, [])

  // Au retour de Stripe, le plan a pu changer entre-temps : on le relit.
  // Le webhook fait foi, cette relecture ne sert qu'à rafraîchir l'affichage.
  // Le portail permettant aussi de changer d'offre ou de résilier, le retour
  // depuis celui-ci déclenche la même relecture.
  useEffect(() => {
    if (paiement === 'succes' || retourPortail) {
      onPlanChanged().catch(() => undefined)
    }
  }, [paiement, retourPortail, onPlanChanged])

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
  const echeance = planUsage?.renewsAt ? new Date(planUsage.renewsAt) : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-brand-deep">Abonnement</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Votre offre actuelle et les formules disponibles.
        </p>
      </div>

      {hasPaidPlan && echeance && (
        <div
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            planUsage?.endsAtPeriodEnd
              ? 'bg-amber-50 text-amber-800'
              : 'bg-brand-mint text-brand-deep'
          }`}
        >
          {planUsage?.endsAtPeriodEnd ? (
            <>
              Votre abonnement est résilié et prend fin le{' '}
              <strong>{DATE_LONGUE.format(echeance)}</strong>. Vous conservez l'accès jusqu'à cette
              date, puis votre compte reviendra à l'offre gratuite. Aucun prélèvement n'interviendra.
            </>
          ) : (
            <>
              Prochain renouvellement le <strong>{DATE_LONGUE.format(echeance)}</strong>. Résiliable
              à tout moment depuis le portail de facturation.
            </>
          )}
        </div>
      )}

      {retourPortail && (
        <div className="mb-4 rounded-md bg-brand-mint px-3 py-2 text-sm text-brand-deep">
          Vos modifications ont été prises en compte. L'offre affichée ci-dessous reflète votre
          abonnement à jour ; un changement programmé ne prendra effet qu'à l'échéance indiquée.
          <button onClick={() => setSearchParams({})} className="ml-2 font-medium underline">
            Fermer
          </button>
        </div>
      )}

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
                ) : entry.purchasable && hasPaidPlan ? (
                  <button
                    onClick={handlePortal}
                    disabled={pendingPlan !== null}
                    className="w-full rounded-md border border-brand-border px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-mint disabled:opacity-60"
                  >
                    {pendingPlan === 'portal' ? 'Redirection...' : 'Changer pour cette offre'}
                  </button>
                ) : entry.purchasable ? (
                  <button
                    onClick={() => {
                      setRenonciation(false)
                      setOffreAConfirmer(entry)
                    }}
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

      {/* La suppression figure ici, sous la gestion de l'abonnement : c'est
          la page où l'on vient quand on veut partir, et l'ordre évite qu'on
          la rencontre par hasard. */}
      <div className="mt-6 space-y-4">
        <ExporterMesDonnees />
        <SupprimerCompte onSupprime={onCompteSupprime} />
      </div>

      {offreAConfirmer && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOffreAConfirmer(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-confirmation"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_60px_-15px_rgba(11,46,47,0.35)]"
          >
            <h2
              id="titre-confirmation"
              className="font-heading text-lg font-semibold text-brand-deep"
            >
              Confirmer votre abonnement
            </h2>

            <div className="my-4 rounded-lg bg-brand-mint p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-brand-deep">{offreAConfirmer.label}</span>
                <span className="font-heading text-lg font-semibold text-brand-deep">
                  {formatPrice(offreAConfirmer.monthlyPrice)}
                </span>
              </div>
              <p className="mt-1 text-xs text-brand-muted">
                Sans engagement, résiliable à tout moment. TVA non applicable, article 293 B du
                CGI : ce montant est celui réellement prélevé.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={renonciation}
                onChange={(e) => setRenonciation(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#2f8f6f]"
              />
              <span className="text-[13px] leading-relaxed text-brand-ink">
                Je demande l'accès immédiat au service et reconnais qu'une fois celui-ci pleinement
                exécuté, je perdrai mon droit de rétractation de quatorze jours. J'accepte les{' '}
                <Link to="/cgv" className="text-brand-green underline" target="_blank">
                  conditions générales de vente
                </Link>
                .
              </span>
            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setOffreAConfirmer(null)}
                className="rounded-md border border-brand-border px-4 py-2.5 text-sm font-medium text-brand-deep hover:bg-brand-mint"
              >
                Annuler
              </button>
              <button
                onClick={() => handleSubscribe(offreAConfirmer.plan as 'premium' | 'pro')}
                disabled={!renonciation || pendingPlan !== null}
                className="brand-gradient rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingPlan ? 'Redirection...' : 'Continuer vers le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-brand-muted">
        Paiement sécurisé par Stripe. SYNeco ne conserve aucune donnée bancaire. TVA non
        applicable, article 293 B du CGI : les montants affichés sont ceux réellement prélevés.
      </p>
    </div>
  )
}
