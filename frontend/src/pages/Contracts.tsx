import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Contract, Document, RenewalType } from '../types'
import { ApiError } from '../services/api'
import { formatDate } from '../utils/formatDate'

interface ContractsProps {
  contracts: Contract[]
  documents: Document[]
  onAdd: (data: {
    provider: string
    startDate: string
    endDate: string
    amount: number
    renewalType: RenewalType
    documentId: string
  }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const renewalLabels: Record<RenewalType, string> = {
  tacite: 'Reconduction tacite',
  manuel: 'Renouvellement manuel',
  aucun: 'Aucun renouvellement',
}

export default function Contracts({ contracts, documents, onAdd, onDelete }: ContractsProps) {
  const [showForm, setShowForm] = useState(false)
  const [provider, setProvider] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [amount, setAmount] = useState('')
  const [renewalType, setRenewalType] = useState<RenewalType>('aucun')
  const [documentId, setDocumentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!provider.trim() || !startDate || !endDate || !amount || !documentId) return
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({
        provider: provider.trim(),
        startDate,
        endDate,
        amount: Number(amount),
        renewalType,
        documentId,
      })
      setProvider('')
      setStartDate('')
      setEndDate('')
      setAmount('')
      setRenewalType('aucun')
      setDocumentId('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer le contrat')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de supprimer le contrat')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-[28px] font-semibold text-brand-deep">Contrats</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          disabled={documents.length === 0}
          className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {showForm ? 'Annuler' : '+ Nouveau contrat'}
        </button>
      </div>

      {documents.length === 0 && (
        <p className="mb-4 text-sm text-brand-muted">
          Ajoute d'abord un document pour pouvoir y rattacher un contrat.
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-brand-border bg-white p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label htmlFor="ct-provider" className="mb-1 block text-sm font-medium text-brand-deep">
              Organisme
            </label>
            <input
              id="ct-provider"
              type="text"
              required
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
              placeholder="Ex : AXA, EDF, Bouygues Telecom..."
            />
          </div>
          <div>
            <label htmlFor="ct-start" className="mb-1 block text-sm font-medium text-brand-deep">
              Date de début
            </label>
            <input
              id="ct-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="ct-end" className="mb-1 block text-sm font-medium text-brand-deep">
              Date de fin
            </label>
            <input
              id="ct-end"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="ct-amount" className="mb-1 block text-sm font-medium text-brand-deep">
              Montant (€)
            </label>
            <input
              id="ct-amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="ct-renewal" className="mb-1 block text-sm font-medium text-brand-deep">
              Renouvellement
            </label>
            <select
              id="ct-renewal"
              value={renewalType}
              onChange={(e) => setRenewalType(e.target.value as RenewalType)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            >
              {Object.entries(renewalLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ct-doc" className="mb-1 block text-sm font-medium text-brand-deep">
              Document lié
            </label>
            <select
              id="ct-doc"
              required
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            >
              <option value="">Sélectionner un document</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Création...' : 'Créer le contrat'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-brand-border bg-white">
        {contracts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-muted">Aucun contrat.</p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {contracts.map((c) => {
              const linkedDoc = documents.find((doc) => doc.id === c.documentId)
              return (
                <li key={c.id} className="flex flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">{c.provider}</p>
                    <p className="text-xs text-brand-muted">
                      {formatDate(c.startDate)} → {formatDate(c.endDate)} · {c.amount.toFixed(2)} € ·{' '}
                      {renewalLabels[c.renewalType]}
                      {linkedDoc ? ` · ${linkedDoc.name}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-sm text-brand-muted hover:text-brand-danger"
                  >
                    Supprimer
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
