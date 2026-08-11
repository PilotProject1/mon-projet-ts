import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Document, DocumentType } from '../types'
import { ApiError } from '../services/api'
import { formatDate } from '../utils/formatDate'

interface DocumentsProps {
  documents: Document[]
  onAdd: (data: { name: string; type: DocumentType; fileUrl: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const typeLabels: Record<DocumentType, string> = {
  contrat: 'Contrat',
  facture: 'Facture',
  assurance: 'Assurance',
  garantie: 'Garantie',
  courrier: 'Courrier',
  autre: 'Autre',
}

export default function Documents({ documents, onAdd, onDelete }: DocumentsProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'tous'>('tous')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<DocumentType>('autre')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filtered = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'tous' || doc.type === typeFilter
    return matchesSearch && matchesType
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({ name: name.trim(), type, fileUrl: '#' })
      setName('')
      setType('autre')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter le document")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de supprimer le document')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          {showForm ? 'Annuler' : '+ Ajouter un document'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div>
            <label htmlFor="doc-name" className="mb-1 block text-sm font-medium text-gray-700">
              Nom du document
            </label>
            <input
              id="doc-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
              placeholder="Ex : Facture électricité août"
            />
          </div>
          <div>
            <label htmlFor="doc-type" className="mb-1 block text-sm font-medium text-gray-700">
              Type
            </label>
            <select
              id="doc-type"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400">
            Le dépôt réel de fichier (PDF/image) sera ajouté en Phase 6.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      )}

      <div className="mb-4 flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un document..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as DocumentType | 'tous')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
        >
          <option value="tous">Tous les types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">Aucun document trouvé.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                  <p className="text-xs text-gray-500">
                    {typeLabels[doc.type]} · Ajouté le {formatDate(doc.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      doc.status === 'traite'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {doc.status === 'traite' ? 'Traité' : 'En attente'}
                  </span>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-sm text-gray-400 hover:text-red-600"
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
