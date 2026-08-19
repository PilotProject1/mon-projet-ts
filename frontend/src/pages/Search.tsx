import { useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { searchApi, ApiError } from '../services/api'
import type { Deadline, Document, SearchAnswer, SearchHit, DocumentType } from '../types'
import { suggestionsRecherche } from '../utils/suggestionsRecherche'
import { useEntree } from '../utils/useApparition'
import { formatDate } from '../utils/formatDate'
import { formatAmount } from '../utils/formatAmount'

const typeLabels: Record<DocumentType, string> = {
  contrat: 'Contrat',
  facture: 'Facture',
  assurance: 'Assurance',
  garantie: 'Garantie',
  courrier: 'Courrier',
  autre: 'Autre',
}

const kindLabels: Record<SearchHit['kind'], string> = {
  document: 'Document',
  deadline: 'Échéance',
  contract: 'Contrat',
  invoice: 'Facture',
}

function safeDate(value: unknown) {
  const text = String(value ?? '')
  return text ? formatDate(text) : '—'
}

function describeHit(hit: SearchHit): { title: string; subtitle: string } {
  const item = hit.item
  switch (hit.kind) {
    case 'document': {
      const type = item.type as DocumentType | undefined
      // Ce que la lecture du document a appris de lui prime sur la date de
      // dépôt : « EDF · 128,40 € · document du 1 août » situe la pièce, là
      // où « ajouté le 15 août » ne dit rien de son contenu.
      const faits = [
        type ? typeLabels[type] : 'Document',
        item.provider ? String(item.provider) : null,
        typeof item.amount === 'number' ? formatAmount(item.amount) : null,
        item.documentDate
          ? `du ${safeDate(item.documentDate)}`
          : `ajouté le ${safeDate(item.createdAt)}`,
      ].filter(Boolean)
      return { title: String(item.name ?? 'Document'), subtitle: faits.join(' · ') }
    }
    case 'deadline':
      return {
        title: String(item.title ?? 'Échéance'),
        subtitle: `Échéance le ${safeDate(item.dueDate)}`,
      }
    case 'contract':
      return {
        title: String(item.provider ?? 'Contrat'),
        subtitle: `${formatAmount(item.amount)} · du ${safeDate(item.startDate)} au ${safeDate(item.endDate)}`,
      }
    case 'invoice': {
      const client = item.client as { name?: string } | undefined
      return {
        title: `Facture ${String(item.number ?? '')}`,
        subtitle: `${formatAmount(item.total)} · ${client?.name ?? ''} · Échéance le ${safeDate(item.dueDate)}`,
      }
    }
  }
}

interface SearchProps {
  documents: Document[]
  deadlines: Deadline[]
}

export default function Search({ documents, deadlines }: SearchProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState<SearchAnswer | null>(null)

  const suggestions = useMemo(
    () => suggestionsRecherche(documents, deadlines),
    [documents, deadlines],
  )
  const listeSuggestions = useEntree<HTMLDivElement>()

  async function lancer(question: string) {
    const propre = question.trim()
    if (!propre) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      setAnswer(await searchApi.ask(propre))
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'interroger l'assistant pour le moment",
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await lancer(query)
  }

  /*
   * Vider le champ ramène la page à son point de départ.
   *
   * Sans cela, la réponse survivait à la question qui l'avait produite : un
   * texte orphelin restait affiché, et il masquait les suggestions qu'on
   * était précisément revenu chercher en effaçant sa question.
   */
  function modifierQuestion(valeur: string) {
    setQuery(valeur)
    if (!valeur.trim()) {
      setAnswer(null)
      setError(null)
    }
  }

  /*
   * Une suggestion se lance d'un seul geste : la recopier dans le champ pour
   * faire ensuite appuyer sur « Rechercher » demanderait deux gestes là où le
   * propos est justement d'en épargner. Le champ est tout de même renseigné,
   * pour que la question reste modifiable après coup.
   */
  async function choisir(question: string) {
    setQuery(question)
    await lancer(question)
  }

  return (
    <div>
      <h1 className="mb-2 text-[28px] font-bold text-brand-deep">Recherche</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Posez une question en langage naturel sur vos documents, échéances, contrats ou factures.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => modifierQuestion(e.target.value)}
          placeholder="Votre question…"
          className="min-w-0 flex-1 rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="brand-gradient shrink-0 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Recherche...' : 'Rechercher'}
        </button>
      </form>

      {/*
        Les suggestions disparaissent dès qu'une réponse s'affiche : leur rôle
        est d'amorcer, pas d'encombrer une page qui a déjà répondu. Elles
        reviennent au vidage du champ.
      */}
      {!answer && (
        <div
          ref={listeSuggestions.ref}
          className={`mvt-liste mt-4 flex flex-wrap gap-2 ${listeSuggestions.classe}`}
        >
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand-muted">
            <Sparkles size={14} className="text-brand-green" />
            Par exemple
          </span>
          {suggestions.map((suggestion, rang) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void choisir(suggestion)}
              disabled={loading}
              style={{ '--rang': rang + 1 } as CSSProperties}
              className="mvt-carte max-w-full rounded-full border border-brand-border bg-white px-3 py-1.5 text-left text-[12.5px] text-brand-deep hover:border-brand-green hover:bg-brand-mint/50 disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="mb-6" />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {answer && (
        <div className="space-y-4">
          <div className="rounded-lg border border-brand-border bg-white p-4">
            <p className="text-sm text-brand-ink">{answer.summary}</p>
          </div>

          {answer.results.length > 0 && (
            <ul className="divide-y divide-brand-border rounded-lg border border-brand-border bg-white">
              {answer.results.map((hit, index) => {
                const { title, subtitle } = describeHit(hit)
                return (
                  <li key={index} className="px-4 py-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full bg-brand-mint px-2 py-0.5 text-xs font-medium text-brand-deep">
                        {kindLabels[hit.kind]}
                      </span>
                      <p className="text-sm font-medium text-brand-ink">{title}</p>
                    </div>
                    <p className="text-xs text-brand-muted">{subtitle}</p>
                    <p className="mt-1 text-xs text-brand-muted italic">{hit.reason}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
