import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Document, DocumentType } from '../types'
import { ApiError, documentsApi } from '../services/api'
import { formatDate } from '../utils/formatDate'

interface DocumentsProps {
  documents: Document[]
  onAdd: (data: { name: string; type: DocumentType; file: File }) => Promise<void>
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

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function Documents({ documents, onAdd, onDelete }: DocumentsProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'tous'>('tous')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<DocumentType>('autre')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'tous' || doc.type === typeFilter
    return matchesSearch && matchesType
  })

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setError(null)
    if (selected && !ALLOWED_MIME_TYPES.includes(selected.type)) {
      setError('Type de fichier non autorisé (PDF, JPG, PNG ou WEBP uniquement)')
      setFile(null)
      e.target.value = ''
      return
    }
    if (selected && selected.size > MAX_FILE_SIZE_BYTES) {
      setError('Fichier trop volumineux (10 Mo maximum)')
      setFile(null)
      e.target.value = ''
      return
    }
    setFile(selected)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !file) return
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({ name: name.trim(), type, file })
      setName('')
      setType('autre')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
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

  async function handleView(doc: Document) {
    setError(null)
    setOpeningId(doc.id)
    try {
      const blob = await documentsApi.getFileBlob(doc.id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ouvrir le document")
    } finally {
      setOpeningId(null)
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
          <div>
            <label htmlFor="doc-file" className="mb-1 block text-sm font-medium text-gray-700">
              Fichier (PDF, JPG, PNG ou WEBP, 10 Mo max)
            </label>
            <input
              id="doc-file"
              ref={fileInputRef}
              type="file"
              required
              accept={ALLOWED_MIME_TYPES.join(',')}
              onChange={handleFileChange}
              className="w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-purple-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-purple-700 hover:file:bg-purple-100"
            />
            {file && (
              <p className="mt-1 text-xs text-gray-400">
                {file.name} · {formatSize(file.size)}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting || !file}
            className="rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {submitting ? 'Envoi...' : 'Enregistrer'}
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
                    {typeLabels[doc.type]} · {formatSize(doc.sizeBytes)} · Ajouté le{' '}
                    {formatDate(doc.createdAt)}
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
                    onClick={() => handleView(doc)}
                    disabled={openingId === doc.id}
                    className="text-sm text-gray-400 hover:text-purple-600 disabled:opacity-60"
                  >
                    {openingId === doc.id ? 'Ouverture...' : 'Voir'}
                  </button>
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
