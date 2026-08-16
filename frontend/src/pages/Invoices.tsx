import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Client, Company, Invoice, InvoiceStatus } from '../types'
import { ApiError } from '../services/api'
import { formatDate } from '../utils/formatDate'
import { formatAmount } from '../utils/formatAmount'

interface InvoicesProps {
  company: Company | null
  clients: Client[]
  invoices: Invoice[]
  onAdd: (data: { clientId: string; total: number; dueDate: string }) => Promise<void>
  onUpdateStatus: (id: string, status: InvoiceStatus) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const statusLabels: Record<InvoiceStatus, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  payee: 'Payée',
  en_retard: 'En retard',
}

const statusStyles: Record<InvoiceStatus, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  envoyee: 'bg-amber-100 text-amber-700',
  payee: 'bg-green-100 text-green-700',
  en_retard: 'bg-red-100 text-red-700',
}

export default function Invoices({
  company,
  clients,
  invoices,
  onAdd,
  onUpdateStatus,
  onDelete,
}: InvoicesProps) {
  const [showForm, setShowForm] = useState(false)
  const [clientId, setClientId] = useState('')
  const [total, setTotal] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  if (!company) {
    return (
      <div>
        <h1 className="mb-6 text-[28px] font-bold text-brand-deep">Factures</h1>
        <p className="text-sm text-brand-muted">
          Crée d'abord{' '}
          <Link to="/entreprise" className="font-medium text-brand-green hover:underline">
            ton entreprise
          </Link>{' '}
          pour pouvoir facturer.
        </p>
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-[28px] font-bold text-brand-deep">Factures</h1>
        <p className="text-sm text-brand-muted">
          Ajoute d'abord{' '}
          <Link to="/clients" className="font-medium text-brand-green hover:underline">
            un client
          </Link>{' '}
          pour pouvoir créer une facture.
        </p>
      </div>
    )
  }

  const totalFacture = invoices.reduce((sum, i) => sum + i.total, 0)
  const totalEnAttente = invoices
    .filter((i) => i.status === 'brouillon' || i.status === 'envoyee' || i.status === 'en_retard')
    .reduce((sum, i) => sum + i.total, 0)
  const totalPaye = invoices
    .filter((i) => i.status === 'payee')
    .reduce((sum, i) => sum + i.total, 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clientId || !total || !dueDate) return
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({ clientId, total: Number(total), dueDate })
      setClientId('')
      setTotal('')
      setDueDate('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer la facture')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(id: string, status: InvoiceStatus) {
    setError(null)
    setUpdatingId(id)
    try {
      await onUpdateStatus(id, status)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de mettre à jour la facture')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de supprimer cette facture')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-brand-deep">Factures</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white"
        >
          {showForm ? 'Annuler' : '+ Nouvelle facture'}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="brand-card-shadow rounded-[18px] border border-brand-border bg-white p-4">
          <p className="mb-1 text-sm font-medium text-brand-muted">Total facturé</p>
          <p className="text-2xl font-bold text-brand-deep">{formatAmount(totalFacture)}</p>
        </div>
        <div className="brand-card-shadow rounded-[18px] border border-brand-border bg-white p-4">
          <p className="mb-1 text-sm font-medium text-brand-muted">En attente</p>
          <p className="text-2xl font-bold text-brand-deep">{formatAmount(totalEnAttente)}</p>
        </div>
        <div className="brand-card-shadow rounded-[18px] border border-brand-border bg-white p-4">
          <p className="mb-1 text-sm font-medium text-brand-muted">Payé</p>
          <p className="text-2xl font-bold text-brand-green">{formatAmount(totalPaye)}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-brand-border bg-white p-4 sm:grid-cols-3"
        >
          <div>
            <label htmlFor="inv-client" className="mb-1 block text-sm font-medium text-brand-deep">
              Client
            </label>
            <select
              id="inv-client"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            >
              <option value="">Sélectionner un client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inv-total" className="mb-1 block text-sm font-medium text-brand-deep">
              Montant (€)
            </label>
            <input
              id="inv-total"
              type="number"
              min="0"
              step="0.01"
              required
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="inv-due" className="mb-1 block text-sm font-medium text-brand-deep">
              Échéance de paiement
            </label>
            <input
              id="inv-due"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Création...' : 'Créer la facture'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-brand-border bg-white">
        {invoices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-muted">Aucune facture.</p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-brand-ink">
                    {invoice.number} · {invoice.clientName}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {formatAmount(invoice.total)} · Échéance le {formatDate(invoice.dueDate)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:shrink-0">
                  <select
                    value={invoice.status}
                    disabled={updatingId === invoice.id}
                    onChange={(e) =>
                      handleStatusChange(invoice.id, e.target.value as InvoiceStatus)
                    }
                    className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${statusStyles[invoice.status]}`}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(invoice.id)}
                    className="text-sm text-brand-muted hover:text-brand-danger"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
