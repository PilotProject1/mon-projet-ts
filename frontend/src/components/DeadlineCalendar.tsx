import { useState } from 'react'
import type { Deadline } from '../types'
import { formatDate } from '../utils/formatDate'

interface DeadlineCalendarProps {
  deadlines: Deadline[]
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_LABEL = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

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

export default function DeadlineCalendar({ deadlines }: DeadlineCalendarProps) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const byDay = new Map<string, Deadline[]>()
  for (const d of deadlines) {
    const key = formatDate(d.dueDate)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(d)
  }

  const days = buildMonthGrid(cursor.getFullYear(), cursor.getMonth())
  const todayKey = toKey(today)

  return (
    <div className="brand-card-shadow rounded-lg border border-brand-border bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="rounded-md px-2 py-1 text-sm text-brand-muted hover:bg-brand-mint"
        >
          ← Précédent
        </button>
        <h2 className="text-sm font-semibold capitalize text-brand-deep">
          {MONTH_LABEL.format(cursor)}
        </h2>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="rounded-md px-2 py-1 text-sm text-brand-muted hover:bg-brand-mint"
        >
          Suivant →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-brand-border bg-brand-border text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-brand-mint px-2 py-1 text-center font-medium text-brand-muted">
            {d}
          </div>
        ))}
        {days.map((date) => {
          const key = toKey(date)
          const inMonth = date.getMonth() === cursor.getMonth()
          const dayDeadlines = byDay.get(key) ?? []
          return (
            <div
              key={key}
              className={`min-h-20 bg-white p-1 ${inMonth ? '' : 'bg-brand-mint text-brand-muted/60'} ${
                key === todayKey ? 'ring-2 ring-inset ring-brand-green' : ''
              }`}
            >
              <p
                className={`mb-1 text-right text-xs ${inMonth ? 'text-brand-muted' : 'text-brand-muted/50'}`}
              >
                {date.getDate()}
              </p>
              <div className="space-y-0.5">
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
