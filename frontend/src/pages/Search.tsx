import { useState } from 'react'
import type { FormEvent } from 'react'
import { searchApi, ApiError } from '../services/api'
import type { SearchAnswer, SearchHit, DocumentType } from '../types'
import { formatDate } from '../utils/formatDate'

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

function formatAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `${amount.toFixed(2)} €` : '—'
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
      return {
        title: String(item.name ?? 'Document'),
        subtitle: `${type ? typeLabels[type] : 'Document'} · Ajouté le ${safeDate(item.createdAt)}`,
      }
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

export default function Search() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState<SearchAnswer | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const result = await searchApi.ask(query.trim())
      setAnswer(result)
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

  return (
    <div>
      <h1 className="mb-2 text-[28px] font-bold text-brand-deep">Recherche</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Pose une question en langage naturel sur tes documents, échéances, contrats ou factures.
      </p>

      <form onSubmit={handleSubmit} className="mb-6 flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex : mes factures EDF de plus de 100€ en 2026"
          className="flex-1 rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="brand-gradient rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Recherche...' : 'Rechercher'}
        </button>
      </form>

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
