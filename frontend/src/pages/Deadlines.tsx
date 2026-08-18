import { useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { Deadline, Document } from '../types'
import PriorityBadge from '../components/PriorityBadge'
import DeadlineCalendar from '../components/DeadlineCalendar'
import ReminderSettings from '../components/ReminderSettings'
import { ApiError } from '../services/api'
import { daysUntil, formatDate, formatRelative } from '../utils/formatDate'
import { useEntree } from '../utils/useApparition'

interface DeadlinesProps {
  deadlines: Deadline[]
  documents: Document[]
  onAdd: (data: { title: string; dueDate: string; documentId?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggleStatus: (id: string) => Promise<void>
  onRemind: (id: string) => Promise<void>
}

/** Une échéance dont le jour est passé et qui reste à faire. */
function isOverdue(dueDate: string) {
  const jours = daysUntil(dueDate)
  return jours !== null && jours < 0
}

export default function Deadlines({
  deadlines,
  documents,
  onAdd,
  onDelete,
  onToggleStatus,
  onRemind,
}: DeadlinesProps) {
  const listeEcheances = useEntree<HTMLUListElement>()
  const [view, setView] = useState<'liste' | 'calendrier'>('liste')
  const [statusFilter, setStatusFilter] = useState<'toutes' | 'a_faire' | 'terminee'>('toutes')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

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
        ...(documentId ? { documentId } : {}),
      })
      setTitle('')
      setDueDate('')
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

  async function handleRemind(id: string) {
    setError(null)
    setRemindingId(id)
    try {
      await onRemind(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer le rappel")
    } finally {
      setRemindingId(null)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer l'échéance")
    }
  }

  function handleRequestAdd(prefillDate: string) {
    setDueDate(prefillDate)
    setShowForm(true)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-brand-deep">Échéances</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white"
        >
          {showForm ? 'Annuler' : '+ Nouvelle échéance'}
        </button>
      </div>

      <ReminderSettings />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-brand-border bg-white p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label htmlFor="dl-title" className="mb-1 block text-sm font-medium text-brand-deep">
              Titre
            </label>
            <input
              id="dl-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
              placeholder="Ex : Renouvellement assurance auto"
            />
          </div>
          <div>
            <label htmlFor="dl-date" className="mb-1 block text-sm font-medium text-brand-deep">
              Date d'échéance
            </label>
            <input
              id="dl-date"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="dl-doc" className="mb-1 block text-sm font-medium text-brand-deep">
              Document lié (optionnel)
            </label>
            <select
              id="dl-doc"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            >
              <option value="">Aucun</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-brand-muted sm:col-span-2">
            La priorité est calculée automatiquement selon la proximité de la date d'échéance.
          </p>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Création...' : "Créer l'échéance"}
            </button>
          </div>
        </form>
      )}

      {/* Les deux groupes côte à côte débordaient de l'écran à 390 px, ce qui
          rognait l'onglet « Calendrier » : ils s'empilent sur téléphone. */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(['toutes', 'a_faire', 'terminee'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                statusFilter === value
                  ? 'bg-brand-mint text-brand-deep'
                  : 'text-brand-muted hover:bg-brand-mint'
              }`}
            >
              {value === 'toutes' ? 'Toutes' : value === 'a_faire' ? 'À faire' : 'Terminées'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-md bg-brand-mint p-1">
          {(['liste', 'calendrier'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setView(value)}
              className={`rounded px-3 py-1 text-sm font-medium ${
                view === value ? 'bg-white text-brand-deep shadow-sm' : 'text-brand-muted'
              }`}
            >
              {value === 'liste' ? 'Liste' : 'Calendrier'}
            </button>
          ))}
        </div>
      </div>

      {view === 'calendrier' ? (
        <DeadlineCalendar
          deadlines={filtered}
          documents={documents}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
          onRemind={onRemind}
          onRequestAdd={handleRequestAdd}
        />
      ) : (
        <div className="rounded-lg border border-brand-border bg-white">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-brand-muted">Aucune échéance.</p>
          ) : (
            <ul
              ref={listeEcheances.ref}
              className={`mvt-liste divide-y divide-brand-border ${listeEcheances.classe}`}
            >
              {filtered.map((d, rang) => {
                const linkedDoc = documents.find((doc) => doc.id === d.documentId)
                return (
                  <li
                    key={d.id}
                    className="mvt-ligne flex flex-col items-start gap-2 px-4 py-3 hover:bg-brand-mint/40 sm:flex-row sm:items-center sm:justify-between"
                    style={{ '--rang': rang } as CSSProperties}
                  >
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          d.status === 'terminee' ? 'text-brand-muted line-through' : 'text-brand-ink'
                        }`}
                      >
                        {d.title}
                      </p>
                      <p className="text-xs text-brand-muted">
                        {formatDate(d.dueDate)}
                        {d.status !== 'terminee' && (
                          // Le délai restant prime sur la date : c'est ce qu'on
                          // cherche en lisant une échéance. En retard, il passe
                          // au rouge et devient l'information la plus visible.
                          <span
                            className={
                              isOverdue(d.dueDate)
                                ? ' font-semibold text-brand-danger'
                                : ' text-brand-muted'
                            }
                          >
                            {' · '}
                            {formatRelative(d.dueDate)}
                          </span>
                        )}
                        {linkedDoc ? ` · ${linkedDoc.name}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:shrink-0">
                      <PriorityBadge priority={d.priority} />
                      <button
                        onClick={() => handleRemind(d.id)}
                        disabled={remindingId === d.id}
                        className="text-sm text-brand-muted hover:text-brand-green disabled:opacity-60"
                      >
                        {remindingId === d.id ? 'Envoi...' : 'Rappel'}
                      </button>
                      <button
                        onClick={() => handleToggle(d.id)}
                        className="text-sm font-medium text-brand-green hover:underline"
                      >
                        {d.status === 'terminee' ? 'Réouvrir' : 'Terminer'}
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-sm text-brand-muted hover:text-brand-danger"
                      >
                        Supprimer
                      </button>
                    </div>
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
