import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import type {
  BillingInterval,
  PlanCatalogueEntry,
  PlanFeature,
  PlanUsage,
} from '../types'
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

function montant(euros: number) {
  // Les centimes ne s'affichent que s'il y en a : « 199 € » se lit mieux que
  // « 199,00 € », et l'un comme l'autre est le montant réellement prélevé.
  return Number.isInteger(euros)
    ? `${euros} €`
    : `${euros.toFixed(2).replace('.', ',')} €`
}

/** Prix affiché pour une offre, selon la périodicité choisie. */
function formatPrice(entry: PlanCatalogueEntry, interval: BillingInterval) {
  if (entry.monthlyPrice === 0) return 'Gratuit'
  if (interval === 'annuel' && entry.yearlyPrice !== null) {
    return `${montant(entry.yearlyPrice)}/an`
  }
  return `${montant(entry.monthlyPrice)}/mois`
}

/**
 * Économie réalisée à l'année, exprimée en mois offerts : c'est ainsi que le
 * lecteur la compare, bien plus vite qu'avec un pourcentage.
 */
function moisOfferts(entry: PlanCatalogueEntry): number | null {
  if (entry.monthlyPrice <= 0 || entry.yearlyPrice === null) return null
  const economie = entry.monthlyPrice * 12 - entry.yearlyPrice
  const mois = Math.round(economie / entry.monthlyPrice)
  return mois > 0 ? mois : null
}

/**
 * Une offre n'est vendable à l'année que si le serveur en connaît le tarif :
 * le prix annoncé au catalogue ne suffit pas, il faut qu'il existe aussi chez
 * Stripe. Sans cette vérification, la bascule « Annuel » mènerait à un
 * paiement refusé.
 */
function offreALAnnee(entry: PlanCatalogueEntry): boolean {
  return entry.purchasable && entry.purchasableIntervals.includes('annuel')
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
  // Confirmation d'une action menée sans quitter la page : contrairement au
  // retour de Stripe, rien dans l'URL ne dirait qu'elle a abouti.
  const [message, setMessage] = useState<string | null>(null)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  // Renonciation expresse au droit de rétractation, exigée pour un service
  // numérique exécuté immédiatement (art. L221-25 du Code de la consommation).
  const [renonciation, setRenonciation] = useState(false)
  // Offre choisie, en attente de confirmation. Le consentement est recueilli
  // dans cet écran plutôt que sur la page : il se rattache ainsi à une
  // commande précise — offre et prix affichés — et non à une intention vague.
  const [offreAConfirmer, setOffreAConfirmer] = useState<PlanCatalogueEntry | null>(null)
  // L'annuel est proposé par défaut : c'est la formule la plus avantageuse
  // pour l'abonné, et celle qui tient le mieux dans le temps.
  const [intervalle, setIntervalle] = useState<BillingInterval>('annuel')
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

  async function handleSubscribe(plan: 'premium' | 'pro', interval: BillingInterval) {
    setError(null)
    setPendingPlan(plan)
    try {
      const { url } = await billingApi.checkout(plan, interval)
      window.location.href = url
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible d’ouvrir le paiement')
      setPendingPlan(null)
    }
  }

  /**
   * Change l'offre d'un abonnement déjà en cours, sans passer par le portail
   * Stripe : celui-ci dépend d'une configuration propre à chaque mode et
   * refuse de changer d'offre un abonnement en cours de résiliation.
   */
  async function handleChangerOffre(plan: 'premium' | 'pro', interval: BillingInterval) {
    setError(null)
    setPendingPlan(plan)
    try {
      await billingApi.changerOffre(plan, interval)
      await onPlanChanged()
      setOffreAConfirmer(null)
      setMessage('Votre offre a été modifiée.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de changer d’offre')
    } finally {
      setPendingPlan(null)
    }
  }

  /** Revient sur une résiliation tant que l'abonnement court encore. */
  async function handleReprendre() {
    setError(null)
    setPendingPlan('reprise')
    try {
      await billingApi.reprendre()
      await onPlanChanged()
      setMessage('Votre abonnement se poursuit : la résiliation est annulée.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de reprendre l’abonnement')
    } finally {
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

  /**
   * Périodicité réellement applicable à une offre : toutes ne sont pas
   * vendues à l'année, et proposer un tarif annuel inexistant mènerait à un
   * paiement refusé côté Stripe.
   */
  function intervalleDe(entry: PlanCatalogueEntry): BillingInterval {
    return intervalle === 'annuel' && offreALAnnee(entry) ? 'annuel' : 'mensuel'
  }

  const currentPlan = planUsage?.plan
  const hasPaidPlan = currentPlan && currentPlan !== 'gratuit'
  const auMoinsUneOffreAnnuelle = catalogue.some(offreALAnnee)
  const echeance = planUsage?.renewsAt ? new Date(planUsage.renewsAt) : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-[28px] font-semibold text-brand-deep">Abonnement</h1>
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
              {/* Revenir sur sa décision doit tenir en un geste, tant que
                  l'abonnement court : autrement, le seul chemin est d'attendre
                  la fin de la période, c'est-à-dire de partir. */}
              <button
                onClick={handleReprendre}
                disabled={pendingPlan !== null}
                className="mt-2 block rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                {pendingPlan === 'reprise' ? 'Reprise...' : 'Reprendre mon abonnement'}
              </button>
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
      {message && (
        <div className="mb-4 rounded-md bg-brand-mint px-3 py-2 text-sm text-brand-deep">
          {message}
        </div>
      )}

      {/* Bascule mensuel / annuel. Masquée tant qu'aucune offre n'a de tarif
          annuel : un sélecteur sans effet ne ferait qu'égarer. */}
      {auMoinsUneOffreAnnuelle && (
        <div className="mb-4 flex justify-center">
          <div
            role="group"
            aria-label="Périodicité de facturation"
            className="inline-flex rounded-full border border-brand-border bg-white p-1"
          >
            {(['mensuel', 'annuel'] as const).map((valeur) => (
              <button
                key={valeur}
                type="button"
                onClick={() => setIntervalle(valeur)}
                aria-pressed={intervalle === valeur}
                className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                  intervalle === valeur
                    ? 'brand-gradient text-white'
                    : 'text-brand-muted hover:text-brand-deep'
                }`}
              >
                {valeur === 'mensuel' ? 'Mensuel' : 'Annuel'}
                {valeur === 'annuel' && intervalle !== 'annuel' && (
                  <span className="ml-1.5 text-brand-green">−2 mois</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {catalogue.map((entry) => {
          // Le plan seul ne suffit plus à dire « c'est votre offre » : au
          // même plan, mensuel et annuel sont deux formules distinctes, et
          // les confondre priverait un abonné mensuel du passage à l'année.
          const intervalleVise = intervalleDe(entry)
          const isCurrent =
            entry.plan === currentPlan &&
            (planUsage?.interval === null || planUsage?.interval === intervalleVise)
          const changement = Boolean(hasPaidPlan) && entry.purchasable
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
                <div className="min-w-0">
                  <p className="font-heading text-base font-semibold text-brand-deep">
                    {entry.label}
                  </p>
                  <p className="text-sm text-brand-muted">
                    {formatPrice(entry, intervalleDe(entry))}
                  </p>
                  {intervalleDe(entry) === 'annuel' && moisOfferts(entry) && (
                    <p className="mt-0.5 text-xs font-medium text-brand-green">
                      {moisOfferts(entry)} mois offerts
                    </p>
                  )}
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
                    onClick={() => {
                      setRenonciation(false)
                      setOffreAConfirmer(entry)
                    }}
                    disabled={pendingPlan !== null}
                    className="brand-gradient w-full rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pendingPlan === entry.plan
                      ? changement
                        ? 'Modification...'
                        : 'Redirection...'
                      : changement
                        ? entry.plan === currentPlan
                          ? intervalleVise === 'annuel'
                            ? 'Passer à l’année'
                            : 'Passer au mois'
                          : 'Changer pour cette offre'
                        : `Choisir ${entry.label}`}
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
              {hasPaidPlan ? 'Confirmer le changement' : 'Confirmer votre abonnement'}
            </h2>

            <div className="my-4 rounded-lg bg-brand-mint p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 font-medium text-brand-deep">
                  {offreAConfirmer.label}
                </span>
                <span className="font-heading shrink-0 text-lg font-semibold text-brand-deep">
                  {formatPrice(offreAConfirmer, intervalleDe(offreAConfirmer))}
                </span>
              </div>
              <p className="mt-1 text-xs text-brand-muted">
                {/* La formule annuelle est prélevée en une fois : annoncer
                    « sans engagement » y serait trompeur. */}
                {intervalleDe(offreAConfirmer) === 'annuel'
                  ? 'Prélevé en une fois pour douze mois, puis reconduit annuellement. Résiliable à tout moment depuis le portail : votre accès court alors jusqu’à la fin de l’année payée.'
                  : 'Sans engagement, résiliable à tout moment.'}{' '}
                TVA non applicable, article 293 B du CGI : ce montant est celui réellement prélevé.
              </p>
              {hasPaidPlan && (
                // Rien n'est prélevé au moment du clic : le dire évite de
                // faire hésiter devant un bouton qu'on croit débiteur.
                <p className="mt-2 text-xs text-brand-muted">
                  Le changement prend effet immédiatement. Le temps déjà réglé est décompté et la
                  différence apparaîtra sur votre prochaine facture : rien n’est prélevé
                  maintenant.
                </p>
              )}
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
                onClick={() =>
                  (hasPaidPlan ? handleChangerOffre : handleSubscribe)(
                    offreAConfirmer.plan as 'premium' | 'pro',
                    intervalleDe(offreAConfirmer),
                  )
                }
                disabled={!renonciation || pendingPlan !== null}
                className="brand-gradient rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingPlan
                  ? hasPaidPlan
                    ? 'Modification...'
                    : 'Redirection...'
                  : hasPaidPlan
                    ? 'Confirmer le changement'
                    : 'Continuer vers le paiement'}
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
