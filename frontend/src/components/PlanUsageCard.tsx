import { Gauge } from 'lucide-react'
import type { PlanUsage } from '../types'

interface PlanUsageCardProps {
  usage: PlanUsage
  /** Rendu compact, pour le pied de la barre latérale. */
  compact?: boolean
}

export default function PlanUsageCard({ usage, compact = false }: PlanUsageCardProps) {
  const { used, max } = usage.documents
  const unlimited = max === null
  const ratio = unlimited ? 0 : Math.min(used / max, 1)
  const atLimit = !unlimited && used >= max
  const nearLimit = !unlimited && !atLimit && ratio >= 0.8

  const barColor = atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-brand-green'

  if (compact) {
    return (
      <div className="px-2.5">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[11.5px] font-semibold text-white/80">{usage.label}</span>
          <span className="text-[11px] text-white/50">
            {unlimited ? `${used} docs` : `${used}/${max}`}
          </span>
        </div>
        {!unlimited && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className={`mvt-barre mvt-entre h-full rounded-full ${barColor}`}
              style={{ width: `${Math.max(ratio * 100, 2)}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="brand-card-shadow neon-carte rounded-lg border border-brand-border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-green-soft">
            <Gauge size={16} className="text-brand-green-deep" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-deep">Plan {usage.label}</p>
            <p className="text-xs text-brand-muted">
              {usage.monthlyPrice === 0
                ? 'Gratuit'
                : `${usage.monthlyPrice.toFixed(2).replace('.', ',')} €/mois`}
            </p>
          </div>
        </div>
        <p className="text-sm text-brand-muted">
          {unlimited ? (
            <>
              <span className="font-semibold text-brand-deep">{used}</span> document
              {used > 1 ? 's' : ''} · illimité
            </>
          ) : (
            <>
              <span className="font-semibold text-brand-deep">{used}</span> / {max} documents
            </>
          )}
        </p>
      </div>

      {!unlimited && (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-mint">
            <div
              className={`mvt-barre mvt-entre h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.max(ratio * 100, 2)}%` }}
            />
          </div>
          {atLimit && (
            <p className="mt-2.5 text-xs text-red-700">
              Vous avez atteint la limite de votre plan. Supprimez des documents ou passez à un plan
              supérieur pour en ajouter.
            </p>
          )}
          {nearLimit && (
            <p className="mt-2.5 text-xs text-amber-700">
              Il vous reste {max - used} document{max - used > 1 ? 's' : ''} sur ce plan.
            </p>
          )}
        </>
      )}
    </div>
  )
}
