import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Client, Company } from '../types'
import { ApiError } from '../services/api'

interface ClientsProps {
  company: Company | null
  clients: Client[]
  onAdd: (data: { name: string; email: string; phone?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function Clients({ company, clients, onAdd, onDelete }: ClientsProps) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!company) {
    return (
      <div>
        <h1 className="mb-6 font-heading text-[28px] font-semibold text-brand-deep">Clients</h1>
        <p className="text-sm text-brand-muted">
          Crée d'abord{' '}
          <Link to="/entreprise" className="font-medium text-brand-green hover:underline">
            ton entreprise
          </Link>{' '}
          pour pouvoir ajouter des clients.
        </p>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined })
      setName('')
      setEmail('')
      setPhone('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter le client")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de supprimer ce client')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-[28px] font-semibold text-brand-deep">Clients</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white"
        >
          {showForm ? 'Annuler' : '+ Nouveau client'}
        </button>
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
            <label htmlFor="client-name" className="mb-1 block text-sm font-medium text-brand-deep">
              Nom
            </label>
            <input
              id="client-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
              placeholder="Ex : Société Martin"
            />
          </div>
          <div>
            <label htmlFor="client-email" className="mb-1 block text-sm font-medium text-brand-deep">
              Email
            </label>
            <input
              id="client-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
              placeholder="contact@client.com"
            />
          </div>
          <div>
            <label htmlFor="client-phone" className="mb-1 block text-sm font-medium text-brand-deep">
              Téléphone (optionnel)
            </label>
            <input
              id="client-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
              placeholder="06 00 00 00 00"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Création...' : 'Créer le client'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-brand-border bg-white">
        {clients.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-muted">Aucun client.</p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {clients.map((client) => (
              <li key={client.id} className="flex flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-brand-ink">{client.name}</p>
                  <p className="text-xs text-brand-muted">
                    {client.email}
                    {client.phone ? ` · ${client.phone}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="text-sm text-brand-muted hover:text-brand-danger"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
