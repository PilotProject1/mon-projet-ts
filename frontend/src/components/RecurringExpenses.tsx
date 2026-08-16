import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Repeat, TrendingUp } from 'lucide-react'
import type { Cadence, Recurrences, RecurringSeries } from '../types'
import { recurrencesApi } from '../services/api'
import { formatAmount } from '../utils/formatAmount'
import { daysUntil, formatDate, formatRelative } from '../utils/formatDate'

const cadenceLabels: Record<Cadence, string> = {
  mensuelle: 'tous les mois',
  trimestrielle: 'tous les trimestres',
  semestrielle: 'tous les six mois',
  annuelle: 'tous les ans',
}

/**
 * Les dépenses qui reviennent, reconstituées à partir des factures déposées.
 *
 * Un abonnement ne se signale jamais de lui-même : il se prélève, et l'on
 * s'aperçoit un an plus tard qu'il a augmenté. Cette carte est la seule chose
 * du service qui parle sans qu'on lui ait rien demandé.
 *
 * Elle disparaît entièrement quand il n'y a rien à dire : un compte qui vient
 * de déposer son premier document n'a que faire d'un cadre vide.
 */
export default function RecurringExpenses() {
  const [data, setData] = useState<Recurrences | null>(null)

  useEffect(() => {
    let vivant = true
    recurrencesApi
      .get()
      .then((r) => { if (vivant) setData(r) })
      .catch(() => undefined)
    return () => { vivant = false }
  }, [])

  // Sans modèle, l'émetteur n'est reconnu que s'il figure dans une liste : des
  // factures restent alors hors de toute série. Le dire ne vaut qu'à partir de
  // quelques-unes, et seulement à qui n'a pas déjà la lecture par IA.
  const manques = !data?.aiReading && (data?.unrecognized ?? 0) >= 2

  if (!data || (data.series.length === 0 && !manques)) return null

  return (
    <div className="brand-card-shadow mt-5.5 rounded-[14px] border border-brand-border bg-white px-5.5 py-5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
          Dépenses qui reviennent
        </h2>
        {/* Le total n'a de sens qu'à partir de deux dépenses : sur une seule,
            il répéterait mot pour mot la ligne qui suit. */}
        {data.series.length > 1 && (
          <span className="shrink-0 text-[12.5px] text-brand-muted">
            {formatAmount(data.yearlyTotal)} par an
          </span>
        )}
      </div>
      <p className="mb-3 text-[12.5px] text-brand-muted">
        Reconstituées à partir de vos factures. Rien n&apos;est prélevé ni suivi par SYNeco.
      </p>

      {data.series.length > 0 && (
        <ul className="divide-y divide-brand-border">
          {data.series.map((serie) => (
            <Serie key={serie.provider} serie={serie} />
          ))}
        </ul>
      )}

      {manques && (
        <div className="mt-3 rounded-lg border border-brand-border bg-brand-mint/50 px-3.5 py-3">
          <p className="text-[12.5px] text-brand-ink">
            {/* Le seuil d'affichage étant de deux, le pluriel est acquis. */}
            {data.unrecognized} documents lus sans émetteur reconnu
            {data.series.length > 0 ? ' n’apparaissent pas ici' : ' : rien n’a pu être regroupé'}.
            La lecture sans abonnement s&apos;appuie sur une liste d&apos;organismes courants ;
            l&apos;analyse par intelligence artificielle, elle, reconnaît n&apos;importe quel
            émetteur.
          </p>
          <Link
            to="/abonnement"
            className="mt-1.5 inline-block text-[12.5px] font-semibold text-brand-green hover:underline"
          >
            Voir les offres
          </Link>
        </div>
      )}

      <Link
        to="/documents"
        className="mt-3 inline-block text-[12.5px] font-semibold text-brand-green hover:underline"
      >
        Voir les documents
      </Link>
    </div>
  )
}

/**
 * La prochaine facture attendue. Passé la date, on ne dit pas « en retard » :
 * la facture est peut-être arrivée sans avoir été déposée ici, et accuser
 * l'utilisateur d'un retard qui n'existe pas serait la pire des inventions.
 */
function attente(date: string): string {
  const jours = daysUntil(date)
  if (jours === null) return ''
  return jours < 0
    ? `prochaine attendue depuis le ${formatDate(date)}`
    : `prochaine attendue ${formatRelative(date)}`
}

function Serie({ serie }: { serie: RecurringSeries }) {
  const hausse = serie.variation > 0 && serie.variationPercent >= 2

  return (
    <li className="py-3.5">
      {/* Sur téléphone le montant passe sous le nom : côte à côte, un nom de
          fournisseur un peu long écraserait l'un ou l'autre. */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Repeat size={14} className="shrink-0 text-brand-green" />
          <p className="truncate text-sm font-medium text-brand-ink">{serie.provider}</p>
        </div>
        <p className="text-sm font-semibold text-brand-ink sm:shrink-0">
          {formatAmount(serie.lastAmount)}
          {serie.cadence && (
            <span className="font-normal text-brand-muted"> · {cadenceLabels[serie.cadence]}</span>
          )}
        </p>
      </div>

      <p className="mt-0.5 text-xs text-brand-muted">
        {serie.occurrences.length} factures
        {serie.cadence ? ` · ${formatAmount(serie.yearlyTotal)} par an` : ''}
        {serie.nextExpected ? ` · ${attente(serie.nextExpected)}` : ''}
      </p>

      {hausse && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-brand-amber">
          <TrendingUp size={13} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            En hausse de {formatAmount(serie.variation)} (
            {serie.variationPercent.toFixed(1).replace('.', ',')} %) depuis la facture
            précédente, de {formatAmount(serie.previousAmount)} le{' '}
            {formatDate(serie.occurrences[serie.occurrences.length - 2].date)}.
          </span>
        </p>
      )}
    </li>
  )
}
