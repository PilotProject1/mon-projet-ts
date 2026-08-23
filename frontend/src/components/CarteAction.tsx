import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bell, Info } from 'lucide-react'
import type { ActionProposee } from '../utils/actionsDocument'
import type { Urgence } from '../types'

const styles: Record<Urgence, { teinte: string; Icone: typeof Info }> = {
  urgent: { teinte: '#b4483f', Icone: AlertTriangle },
  attention: { teinte: '#c98a3e', Icone: Bell },
  information: { teinte: '#2f8f6f', Icone: Info },
}

/**
 * Le geste qu'un document appelle, sous sa fiche.
 *
 * Même patron que `SuggestedDeadline` : une pastille, une phrase, un seul
 * geste. Le halo néon reprend la teinte de l'urgence — vert pour une simple
 * piste, ambre puis rouge à mesure que ça presse — pour que l'œil retrouve
 * le même langage que les cases de catégories et le tableau de bord.
 */
export default function CarteAction({ action }: { action: ActionProposee }) {
  const { teinte, Icone } = styles[action.urgence]
  const externe = !action.actionTo.startsWith('/')

  return (
    <div
      className="neon-carte mt-3 rounded-lg border border-brand-border bg-white p-3"
      style={{ '--neon': teinte } as CSSProperties}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: teinte }}
          >
            <Icone size={16} className="text-white" />
          </div>
          <p className="min-w-0 text-[13.5px] text-brand-ink">{action.message}</p>
        </div>

        {externe ? (
          <a
            href={action.actionTo}
            target="_blank"
            rel="noopener noreferrer"
            className="brand-gradient brand-btn-shadow flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-semibold text-white"
          >
            {action.actionLabel}
            <ArrowRight size={13} />
          </a>
        ) : (
          <Link
            to={action.actionTo}
            className="brand-gradient brand-btn-shadow flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-semibold text-white"
          >
            {action.actionLabel}
            <ArrowRight size={13} />
          </Link>
        )}
      </div>
    </div>
  )
}
