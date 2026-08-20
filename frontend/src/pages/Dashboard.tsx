import { Link } from 'react-router-dom'
import { FileText, Clock, CheckCircle2, CalendarClock, Plus } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import type { Document, Deadline } from '../types'
import PriorityBadge from '../components/PriorityBadge'
import RecurringExpenses from '../components/RecurringExpenses'
import Briefing from '../components/Briefing'
import Compteur from '../components/Compteur'
import { useEntree } from '../utils/useApparition'
import { daysUntil, formatDate, formatRelative } from '../utils/formatDate'

interface DashboardProps {
  documents: Document[]
  deadlines: Deadline[]
}

interface StatCardProps {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  label: string
  value: number
  tint: string
  /** Position dans la rangée : commande le décalage de l'entrée. */
  rang: number
}

function StatCard({ icon: Icon, label, value, tint, rang }: StatCardProps) {
  return (
    <div
      className="brand-card-shadow mvt-carte relative min-w-[200px] flex-1 overflow-hidden rounded-[14px] border border-brand-border bg-white px-5.5 py-5"
      style={{ '--rang': rang } as CSSProperties}
    >
      <div className="absolute top-0 left-0 h-full w-1" style={{ background: tint }} />
      <div className="mb-3.5 flex items-center gap-2.5">
        <div
          className="flex h-8.5 w-8.5 items-center justify-center rounded-[9px]"
          style={{ background: `${tint}1A` }}
        >
          <Icon size={18} color={tint} strokeWidth={2.2} />
        </div>
        <span className="text-[13.5px] font-medium text-brand-muted">{label}</span>
      </div>
      <div className="font-heading text-[30px] leading-none font-semibold text-brand-ink">
        <Compteur valeur={value} />
      </div>
    </div>
  )
}

export default function Dashboard({ documents, deadlines }: DashboardProps) {
  const upcoming = deadlines
    .filter((d) => d.status === 'a_faire')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)

  const cartes = useEntree<HTMLDivElement>()
  const liste = useEntree<HTMLUListElement>()

  return (
    <div>
      <div className="mb-6.5">
        <h1 className="font-heading text-[28px] font-semibold text-brand-deep">Tableau de bord</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Bonjour, voici l&apos;état de votre espace aujourd&apos;hui.
        </p>
      </div>

      <Briefing />

      <div ref={cartes.ref} className={`mvt-liste mb-5.5 flex flex-wrap gap-4 ${cartes.classe}`}>
        <StatCard
          icon={FileText}
          label="Documents"
          value={documents.length}
          tint="#12514F"
          rang={0}
        />
        <StatCard
          icon={Clock}
          label="Échéances à faire"
          value={deadlines.filter((d) => d.status === 'a_faire').length}
          tint="#C98A3E"
          rang={1}
        />
        <StatCard
          icon={CheckCircle2}
          label="Échéances terminées"
          value={deadlines.filter((d) => d.status === 'terminee').length}
          tint="#2F8F6F"
          rang={2}
        />
      </div>

      <div className="brand-card-shadow rounded-[14px] border border-brand-border bg-white px-5.5 py-5">
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
            Prochaines échéances
          </h2>
          <Link to="/echeances" className="text-[12.5px] font-semibold text-brand-green hover:underline">
            Voir tout
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3.5 px-5 pt-10 pb-7.5">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full bg-brand-green-soft" />
              <div className="absolute inset-2.5 flex items-center justify-center rounded-full border-2 border-brand-green">
                <CalendarClock size={18} className="text-brand-green-deep" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-brand-ink">Aucune échéance à venir</p>
              <p className="mt-0.5 text-[12.5px] text-brand-muted">
                Ajoutez une échéance pour ne plus jamais la manquer.
              </p>
            </div>
            <Link
              to="/echeances"
              className="flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              <Plus size={15} />
              Ajouter une échéance
            </Link>
          </div>
        ) : (
          <ul ref={liste.ref} className={`mvt-liste divide-y divide-brand-border ${liste.classe}`}>
            {upcoming.map((d, rang) => (
              <li
                key={d.id}
                className="flex items-center justify-between py-3.5"
                style={{ '--rang': rang } as CSSProperties}
              >
                <div>
                  <p className="text-sm font-medium text-brand-ink">{d.title}</p>
                  <p className="text-xs text-brand-muted">
                    {formatDate(d.dueDate)}
                    <span
                      className={
                        (daysUntil(d.dueDate) ?? 0) < 0
                          ? ' font-semibold text-brand-danger'
                          : ''
                      }
                    >
                      {' · '}
                      {formatRelative(d.dueDate)}
                    </span>
                  </p>
                </div>
                <PriorityBadge priority={d.priority} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecurringExpenses />
    </div>
  )
}
