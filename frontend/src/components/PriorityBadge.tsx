import type { DeadlinePriority } from '../types'

const styles: Record<DeadlinePriority, string> = {
  haute: 'bg-red-100 text-red-700',
  moyenne: 'bg-amber-100 text-amber-700',
  basse: 'bg-gray-100 text-gray-600',
}

const labels: Record<DeadlinePriority, string> = {
  haute: 'Haute',
  moyenne: 'Moyenne',
  basse: 'Basse',
}

export default function PriorityBadge({ priority }: { priority: DeadlinePriority }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[priority]}`}>
      {labels[priority]}
    </span>
  )
}
