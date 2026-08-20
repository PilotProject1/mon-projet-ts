import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bell, Info } from 'lucide-react'
import type { Briefing as BriefingData, PointBriefing, Urgence } from '../types'
import { briefingApi } from '../services/api'
import { useEntree } from '../utils/useApparition'

const styles: Record<Urgence, { bord: string; fond: string; texte: string; Icone: typeof Info }> = {
  urgent: {
    bord: 'border-brand-danger/30',
    fond: 'bg-brand-danger/5',
    texte: 'text-brand-danger',
    Icone: AlertTriangle,
  },
  attention: {
    bord: 'border-brand-amber/30',
    fond: 'bg-brand-amber/5',
    texte: 'text-brand-amber',
    Icone: Bell,
  },
  information: {
    bord: 'border-brand-border',
    fond: 'bg-brand-mint/50',
    texte: 'text-brand-muted',
    Icone: Info,
  },
}

/**
 * Ce qui demande une décision, avant qu'on ait rien demandé.
 *
 * Le reste de l'application attend qu'on l'interroge. Ce bloc est le seul qui
 * parle en premier — et seulement quand il a quelque chose à dire : sans
 * point à signaler, il n'affiche rien du tout. Un encart qui se félicite tous
 * les jours que tout aille bien cesse d'être lu au bout d'une semaine.
 */
export default function Briefing() {
  const [data, setData] = useState<BriefingData | null>(null)

  useEffect(() => {
    let vivant = true
    briefingApi
      .get()
      .then((b) => { if (vivant) setData(b) })
      .catch(() => undefined)
    return () => { vivant = false }
  }, [])

  if (!data || data.points.length === 0) return null

  return (
    <ListePoints points={data.points} />
  )
}

function ListePoints({ points }: { points: PointBriefing[] }) {
  const { ref, classe } = useEntree<HTMLDivElement>()
  return (
    <div ref={ref} className={`mvt-liste mb-5.5 space-y-2 ${classe}`}>
      {points.map((point, rang) => (
        <Point key={point.kind} point={point} rang={rang} />
      ))}
    </div>
  )
}

function Point({ point, rang }: { point: PointBriefing; rang: number }) {
  const style = styles[point.urgence]
  const { Icone } = style

  return (
    <div
      className={`rounded-[12px] border ${style.bord} ${style.fond} px-4 py-3`}
      style={{ '--rang': rang } as CSSProperties}
    >
      {/* Sur téléphone l'action passe sous le message : à côté, elle
          réduirait la phrase à deux mots par ligne. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icone size={16} className={`mt-0.5 shrink-0 ${style.texte}`} />
          <p className="min-w-0 text-[13.5px] text-brand-ink">{point.message}</p>
        </div>
        <Link
          to={point.actionTo}
          className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand-green hover:underline"
        >
          {point.actionLabel}
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}
