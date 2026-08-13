import { useState } from 'react'
import type { Deadline, Document } from '../types'
import { formatDate } from '../utils/formatDate'
import PriorityBadge from './PriorityBadge'
import { ApiError } from '../services/api'

interface DeadlineCalendarProps {
  deadlines: Deadline[]
  documents: Document[]
  onToggleStatus: (id: string) => Promise<void>
  onRemind: (id: string) => Promise<void>
  onRequestAdd: (dueDate: string) => void
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_LABEL = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const priorityDot: Record<Deadline['priority'], string> = {
  haute: 'bg-red-500',
  moyenne: 'bg-amber-500',
  basse: 'bg-brand-muted',
}

function buildMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1)
  // getDay(): 0 = dimanche ... on veut la semaine commençant lundi
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + i)
    return date
  })
}

function toKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function DeadlineCalendar({
  deadlines,
  documents,
  onToggleStatus,
  onRemind,
  onRequestAdd,
}: DeadlineCalendarProps) {
  const today = new Date()
  const todayKey = toKey(today)
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const byDay = new Map<string, Deadline[]>()
  for (const d of deadlines) {
    const key = formatDate(d.dueDate)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(d)
  }

  const days = buildMonthGrid(cursor.getFullYear(), cursor.getMonth())
  const selectedDeadlines = byDay.get(selectedKey) ?? []
  const selectedDate = new Date(`${selectedKey}T00:00:00`)

  function selectDate(date: Date) {
    setSelectedKey(toKey(date))
    if (date.getMonth() !== cursor.getMonth() || date.getFullYear() !== cursor.getFullYear()) {
      setCursor(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  function goToToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedKey(todayKey)
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

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
      <div className="brand-card-shadow rounded-lg border border-brand-border bg-white p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-md px-2 py-1 text-sm text-brand-muted hover:bg-brand-mint"
              aria-label="Mois précédent"
            >
              ←
            </button>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-md px-2 py-1 text-sm text-brand-muted hover:bg-brand-mint"
              aria-label="Mois suivant"
            >
              →
            </button>
          </div>
          <h2 className="order-first w-full text-center text-sm font-semibold capitalize text-brand-deep sm:order-none sm:w-auto">
            {MONTH_LABEL.format(cursor)}
          </h2>
          <button
            onClick={goToToday}
            className="rounded-md px-2 py-1 text-sm font-medium text-brand-green hover:bg-brand-mint"
          >
            Aujourd'hui
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-brand-border bg-brand-border text-xs">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="bg-brand-mint px-1 py-1 text-center font-medium text-brand-muted"
            >
              {d}
            </div>
          ))}
          {days.map((date) => {
            const key = toKey(date)
            const inMonth = date.getMonth() === cursor.getMonth()
            const dayDeadlines = byDay.get(key) ?? []
            const isToday = key === todayKey
            const isSelected = key === selectedKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDate(date)}
                className={`min-h-14 bg-white p-1 text-left transition sm:min-h-20 ${
                  inMonth ? '' : 'bg-brand-mint/50 text-brand-muted/60'
                } ${isSelected ? 'ring-2 ring-inset ring-brand-green' : isToday ? 'ring-1 ring-inset ring-brand-green/50' : ''} hover:bg-brand-mint/60`}
              >
                <p
                  className={`mb-1 text-right text-xs ${
                    isToday ? 'font-semibold text-brand-green' : inMonth ? 'text-brand-muted' : 'text-brand-muted/50'
                  }`}
                >
                  {date.getDate()}
                </p>

                {/* Desktop/tablet : titres tronqués */}
                <div className="hidden space-y-0.5 sm:block">
                  {dayDeadlines.slice(0, 3).map((d) => (
                    <div
                      key={d.id}
                      title={d.title}
                      className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] ${
                        d.status === 'terminee' ? 'text-brand-muted line-through' : 'text-brand-ink'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot[d.priority]}`} />
                      <span className="truncate">{d.title}</span>
                    </div>
                  ))}
                  {dayDeadlines.length > 3 && (
                    <p className="text-[10px] text-brand-muted">+{dayDeadlines.length - 3} autres</p>
                  )}
                </div>

                {/* Mobile : pastilles compactes */}
                {dayDeadlines.length > 0 && (
                  <div className="flex flex-wrap items-center gap-0.5 sm:hidden">
                    {dayDeadlines.slice(0, 4).map((d) => (
                      <span
                        key={d.id}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot[d.priority]} ${
                          d.status === 'terminee' ? 'opacity-40' : ''
                        }`}
                      />
                    ))}
                    {dayDeadlines.length > 4 && (
                      <span className="text-[9px] leading-none text-brand-muted">
                        +{dayDeadlines.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="brand-card-shadow flex flex-col rounded-lg border border-brand-border bg-white p-4 lg:sticky lg:top-4">
        <p className="mb-3 text-sm font-semibold capitalize text-brand-deep">
          {DAY_LABEL.format(selectedDate)}
        </p>

        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        {selectedDeadlines.length === 0 ? (
          <p className="mb-4 text-sm text-brand-muted">Aucune échéance ce jour-là.</p>
        ) : (
          <ul className="mb-4 space-y-3">
            {selectedDeadlines.map((d) => {
              const linkedDoc = documents.find((doc) => doc.id === d.documentId)
              return (
                <li key={d.id} className="rounded-md border border-brand-border p-2.5">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p
                      className={`text-sm font-medium ${
                        d.status === 'terminee' ? 'text-brand-muted line-through' : 'text-brand-ink'
                      }`}
                    >
                      {d.title}
                    </p>
                    <PriorityBadge priority={d.priority} />
                  </div>
                  {linkedDoc && <p className="mb-2 text-xs text-brand-muted">{linkedDoc.name}</p>}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRemind(d.id)}
                      disabled={remindingId === d.id}
                      className="text-xs text-brand-muted hover:text-brand-green disabled:opacity-60"
                    >
                      {remindingId === d.id ? 'Envoi...' : 'Rappel'}
                    </button>
                    <button
                      onClick={() => handleToggle(d.id)}
                      className="text-xs font-medium text-brand-green hover:underline"
                    >
                      {d.status === 'terminee' ? 'Réouvrir' : 'Terminer'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <button
          onClick={() => onRequestAdd(selectedKey)}
          className="brand-gradient rounded-md px-3 py-2 text-sm font-semibold text-white"
        >
          + Ajouter une échéance
        </button>
      </div>
    </div>
  )
}
