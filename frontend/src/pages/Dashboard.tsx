import { Link } from 'react-router-dom'
import type { Document, Deadline } from '../types'
import PriorityBadge from '../components/PriorityBadge'
import { formatDate } from '../utils/formatDate'

interface DashboardProps {
  documents: Document[]
  deadlines: Deadline[]
}

export default function Dashboard({ documents, deadlines }: DashboardProps) {
  const upcoming = deadlines
    .filter((d) => d.status === 'a_faire')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)

  return (
    <div>
      <h1 className="mb-8 text-[28px] font-bold text-brand-deep">Tableau de bord</h1>

      <div className="mb-7 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="brand-card-shadow rounded-[18px] border border-brand-border bg-white p-6">
          <p className="mb-2.5 text-sm font-medium text-brand-muted">Documents</p>
          <p className="text-[34px] font-bold text-brand-deep">{documents.length}</p>
        </div>
        <div className="brand-card-shadow rounded-[18px] border border-brand-border bg-white p-6">
          <p className="mb-2.5 text-sm font-medium text-brand-muted">Échéances à faire</p>
          <p className="text-[34px] font-bold text-brand-deep">
            {deadlines.filter((d) => d.status === 'a_faire').length}
          </p>
        </div>
        <div className="brand-card-shadow rounded-[18px] border border-brand-border bg-white p-6">
          <p className="mb-2.5 text-sm font-medium text-brand-muted">Échéances terminées</p>
          <p className="text-[34px] font-bold text-brand-green">
            {deadlines.filter((d) => d.status === 'terminee').length}
          </p>
        </div>
      </div>

      <div className="brand-card-shadow rounded-[18px] border border-brand-border bg-white">
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
          <h2 className="text-[17px] font-semibold text-brand-ink">Prochaines échéances</h2>
          <Link to="/echeances" className="text-sm font-semibold text-brand-green hover:underline">
            Voir tout
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-5 py-6 text-sm text-brand-muted">Aucune échéance à venir.</p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {upcoming.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-brand-ink">{d.title}</p>
                  <p className="text-xs text-brand-muted">Échéance : {formatDate(d.dueDate)}</p>
                </div>
                <PriorityBadge priority={d.priority} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
