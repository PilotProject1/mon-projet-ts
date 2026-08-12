import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Company } from '../types'
import { ApiError } from '../services/api'
import { formatDate } from '../utils/formatDate'

interface CompanyPageProps {
  company: Company | null
  onCreate: (data: { name: string; legalInfo?: string }) => Promise<void>
  onUpdate: (data: { name?: string; legalInfo?: string }) => Promise<void>
}

export default function CompanyPage({ company, onCreate, onUpdate }: CompanyPageProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(company?.name ?? '')
  const [legalInfo, setLegalInfo] = useState(company?.legalInfo ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function startEdit() {
    setName(company?.name ?? '')
    setLegalInfo(company?.legalInfo ?? '')
    setError(null)
    setEditing(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      if (company) {
        await onUpdate({ name: name.trim(), legalInfo: legalInfo.trim() || undefined })
      } else {
        await onCreate({ name: name.trim(), legalInfo: legalInfo.trim() || undefined })
      }
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer l'entreprise")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-[28px] font-bold text-brand-deep">Entreprise</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {!company && !editing && (
        <div className="rounded-lg border border-brand-border bg-white p-6">
          <p className="mb-4 text-sm text-brand-muted">
            Crée ton profil entreprise pour accéder aux clients et factures.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white"
          >
            + Créer mon entreprise
          </button>
        </div>
      )}

      {company && !editing && (
        <div className="rounded-lg border border-brand-border bg-white p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-brand-ink">{company.name}</p>
              {company.legalInfo && (
                <p className="mt-1 text-sm text-brand-muted">{company.legalInfo}</p>
              )}
              <p className="mt-2 text-xs text-brand-muted">
                Créée le {formatDate(company.createdAt)}
              </p>
            </div>
            <button
              onClick={startEdit}
              className="text-sm font-medium text-brand-green hover:underline"
            >
              Modifier
            </button>
          </div>
        </div>
      )}

      {editing && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-lg border border-brand-border bg-white p-4"
        >
          <div>
            <label htmlFor="company-name" className="mb-1 block text-sm font-medium text-brand-deep">
              Nom de l'entreprise
            </label>
            <input
              id="company-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
              placeholder="Ex : Dupont Conseil"
            />
          </div>
          <div>
            <label
              htmlFor="company-legal"
              className="mb-1 block text-sm font-medium text-brand-deep"
            >
              Informations légales (SIRET, forme juridique...)
            </label>
            <input
              id="company-legal"
              type="text"
              value={legalInfo}
              onChange={(e) => setLegalInfo(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
              placeholder="Ex : SIRET 123 456 789 00012"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            {company && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-mint"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
