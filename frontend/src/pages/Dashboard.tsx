import { Link } from 'react-router-dom'
import type { Document, Deadline } from '../types'
import PriorityBadge from '../components/PriorityBadge'

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
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Tableau de bord</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Documents</p>
          <p className="text-2xl font-semibold text-gray-900">{documents.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Échéances à faire</p>
          <p className="text-2xl font-semibold text-gray-900">
            {deadlines.filter((d) => d.status === 'a_faire').length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Échéances terminées</p>
          <p className="text-2xl font-semibold text-gray-900">
            {deadlines.filter((d) => d.status === 'terminee').length}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Prochaines échéances</h2>
          <Link to="/echeances" className="text-sm text-purple-600 hover:underline">
            Voir tout
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">Aucune échéance à venir.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.title}</p>
                  <p className="text-xs text-gray-500">Échéance : {d.dueDate}</p>
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
