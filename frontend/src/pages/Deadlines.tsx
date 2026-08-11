import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Deadline, DeadlinePriority, Document } from '../types'
import PriorityBadge from '../components/PriorityBadge'
import { ApiError } from '../services/api'
import { formatDate } from '../utils/formatDate'

interface DeadlinesProps {
  deadlines: Deadline[]
  documents: Document[]
  onAdd: (data: {
    title: string
    dueDate: string
    priority: DeadlinePriority
    documentId?: string
  }) => Promise<void>
  onToggleStatus: (id: string) => Promise<void>
}

export default function Deadlines({ deadlines, documents, onAdd, onToggleStatus }: DeadlinesProps) {
  const [statusFilter, setStatusFilter] = useState<'toutes' | 'a_faire' | 'terminee'>('toutes')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<DeadlinePriority>('moyenne')
  const [documentId, setDocumentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filtered = deadlines
    .filter((d) => statusFilter === 'toutes' || d.status === statusFilter)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !dueDate) return
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({
        title: title.trim(),
        dueDate,
        priority,
        ...(documentId ? { documentId } : {}),
      })
      setTitle('')
      setDueDate('')
      setPriority('moyenne')
      setDocumentId('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer l'échéance")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(id: string) {
    setError(null)
    try {
      await onToggleStatus(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour l'échéance")
    }
  }

  function handleReminder(title: string) {
    window.alert(`Rappel envoyé pour : "${title}"`)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Échéances</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          {showForm ? 'Annuler' : '+ Nouvelle échéance'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label htmlFor="dl-title" className="mb-1 block text-sm font-medium text-gray-700">
              Titre
            </label>
            <input
              id="dl-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
              placeholder="Ex : Renouvellement assurance auto"
            />
          </div>
          <div>
            <label htmlFor="dl-date" className="mb-1 block text-sm font-medium text-gray-700">
              Date d'échéance
            </label>
            <input
              id="dl-date"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="dl-priority" className="mb-1 block text-sm font-medium text-gray-700">
              Priorité
            </label>
            <select
              id="dl-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as DeadlinePriority)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
            >
              <option value="haute">Haute</option>
              <option value="moyenne">Moyenne</option>
              <option value="basse">Basse</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="dl-doc" className="mb-1 block text-sm font-medium text-gray-700">
              Document lié (optionnel)
            </label>
            <select
              id="dl-doc"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
            >
              <option value="">Aucun</option>
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
              className="rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {submitting ? 'Création...' : "Créer l'échéance"}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex gap-2">
        {(['toutes', 'a_faire', 'terminee'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === value
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {value === 'toutes' ? 'Toutes' : value === 'a_faire' ? 'À faire' : 'Terminées'}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">Aucune échéance.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((d) => {
              const linkedDoc = documents.find((doc) => doc.id === d.documentId)
              return (
                <li key={d.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        d.status === 'terminee' ? 'text-gray-400 line-through' : 'text-gray-900'
                      }`}
                    >
                      {d.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      Échéance : {formatDate(d.dueDate)}
                      {linkedDoc ? ` · ${linkedDoc.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <PriorityBadge priority={d.priority} />
                    <button
                      onClick={() => handleReminder(d.title)}
                      className="text-sm text-gray-400 hover:text-purple-600"
                    >
                      Rappel
                    </button>
                    <button
                      onClick={() => handleToggle(d.id)}
                      className="text-sm font-medium text-purple-600 hover:underline"
                    >
                      {d.status === 'terminee' ? 'Réouvrir' : 'Terminer'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
