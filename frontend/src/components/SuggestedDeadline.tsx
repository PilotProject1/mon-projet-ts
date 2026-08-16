import { useState } from 'react'
import { CalendarClock, Loader2 } from 'lucide-react'
import type { Document } from '../types'
import { ApiError, documentsApi } from '../services/api'
import { formatDayLong, formatRelative } from '../utils/formatDate'

interface SuggestedDeadlineProps {
  document: Document
  /** Rejoue le chargement des échéances et des documents après décision. */
  onSettled: () => Promise<void> | void
}

/**
 * Échéance repérée dans un document, proposée à l'utilisateur.
 *
 * C'est le geste qui fait tenir la promesse du service : sans lui, un document
 * déposé ne déclenche aucun rappel tant que son échéance n'a pas été saisie à
 * la main — ce que personne ne pense à faire.
 *
 * La proposition n'est jamais appliquée d'office : une date lue dans un texte
 * peut se tromper, et une échéance inventée serait pire que pas d'échéance.
 */
export default function SuggestedDeadline({ document, onSettled }: SuggestedDeadlineProps) {
  const [action, setAction] = useState<'accepter' | 'ecarter' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!document.suggestedDueDate) return null

  async function decider(choix: 'accepter' | 'ecarter') {
    setAction(choix)
    setError(null)
    try {
      if (choix === 'accepter') await documentsApi.acceptSuggestion(document.id)
      else await documentsApi.dismissSuggestion(document.id)
      await onSettled()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible')
      setAction(null)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-brand-green/30 bg-brand-green-soft/40 p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-green">
          <CalendarClock size={17} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-deep">Une échéance a été trouvée</p>
          <p className="mt-0.5 text-xs text-brand-muted">
            {document.suggestedDueLabel
              ? `Repérée à la mention « ${document.suggestedDueLabel} ».`
              : 'Repérée dans le texte du document.'}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-brand-border bg-white px-3 py-2.5">
        <p className="text-[15px] font-semibold text-brand-ink">
          {formatDayLong(document.suggestedDueDate)}
        </p>
        <p className="mt-0.5 text-xs text-brand-muted">
          {formatRelative(document.suggestedDueDate)} · vous serez prévenu 30 jours, 7 jours et
          1 jour avant, puis le jour même.
        </p>
      </div>

      {error && <p className="mt-2 text-xs text-brand-danger">{error}</p>}

      {/* Sur téléphone les deux boutons s'empilent : côte à côte, l'intitulé
          du principal serait tronqué. */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => decider('accepter')}
          disabled={action !== null}
          className="brand-gradient flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {action === 'accepter' && <Loader2 size={15} className="animate-spin" />}
          Créer le rappel
        </button>
        <button
          type="button"
          onClick={() => decider('ecarter')}
          disabled={action !== null}
          className="rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-muted hover:bg-brand-mint disabled:opacity-60"
        >
          Ignorer
        </button>
      </div>
    </div>
  )
}
