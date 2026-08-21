import type { DocumentCategory } from '../types'
import { categorie } from './categories'

/**
 * Le pan de vie d'un document, sur une ligne de liste.
 *
 * N'affiche rien pour un document non rangé : une pastille « non classé » sur
 * la moitié des lignes ne dirait rien de plus que leur absence, et prendrait
 * la place de ce qui, lui, a été reconnu.
 */
export default function PastilleCategorie({
  category,
}: {
  category: DocumentCategory | null
}) {
  const c = categorie(category)
  if (!c) return null
  const { icone: Icone, libelle, teinte } = c

  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `${teinte}14`, color: teinte }}
    >
      <Icone size={11.5} strokeWidth={2.4} />
      {libelle}
    </span>
  )
}
