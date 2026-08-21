import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { Document } from '../types'
import { CATEGORIES } from './categories'
import { useEntree } from '../utils/useApparition'

/*
 * Les papiers rangés par pan de vie, sur le tableau de bord.
 *
 * La page d'accueil vend ce rangement — « Maison : électricité, assurance
 * habitation, bail » — depuis avant qu'il existe. Ce bloc est l'endroit où il
 * se voit : trois cases, leur contenu, et le chemin pour y aller.
 *
 * Les cases vides sont montrées elles aussi, avec leurs exemples : c'est là
 * qu'elles servent le plus, puisqu'une case vide dit ce qu'on pourrait y
 * mettre. Le bloc entier disparaît en revanche tant qu'aucun document n'a été
 * déposé — trois cases à zéro sur un espace neuf ne sont qu'un reproche.
 */
export default function RepartitionCategories({ documents }: { documents: Document[] }) {
  const { ref, classe } = useEntree<HTMLDivElement>()
  if (documents.length === 0) return null

  const nonRanges = documents.filter((d) => d.category === null).length

  return (
    <div className="brand-card-shadow neon-carte mt-5.5 rounded-[14px] border border-brand-border bg-white px-5.5 py-5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
          Vos papiers, par domaine
        </h2>
        <Link
          to="/documents"
          className="shrink-0 text-[12.5px] font-semibold text-brand-green hover:underline"
        >
          Voir tout
        </Link>
      </div>

      {/* Empilées sur téléphone : à trois de front sur 390 px, chaque case
          tomberait à une centaine de pixels et tronquerait ses exemples. */}
      <div ref={ref} className={`mvt-liste mt-3.5 grid gap-3 sm:grid-cols-3 ${classe}`}>
        {CATEGORIES.map(({ cle, libelle, exemples, icone: Icone, teinte }, rang) => {
          const nombre = documents.filter((d) => d.category === cle).length
          return (
            <Link
              key={cle}
              to={`/documents?categorie=${cle}`}
              className="mvt-carte neon-carte block rounded-[12px] border px-4 py-3.5"
              style={
                {
                  '--rang': rang,
                  '--neon': teinte,
                  borderColor: `${teinte}40`,
                  background: `${teinte}0A`,
                } as CSSProperties
              }
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
                  style={{ background: `${teinte}1F` }}
                >
                  <Icone size={16} strokeWidth={2.2} style={{ color: teinte }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-brand-ink">
                    {libelle}
                  </p>
                </div>
                <p
                  className="font-heading shrink-0 text-[19px] leading-none font-semibold"
                  style={{ color: teinte }}
                >
                  {nombre}
                </p>
              </div>
              {/* Les exemples de la page d'accueil, mot pour mot : ce qui est
                  promis dehors doit se retrouver dedans. */}
              <p className="mt-2 text-[11.5px] leading-relaxed text-brand-muted">{exemples}</p>
            </Link>
          )
        })}
      </div>

      {nonRanges > 0 && (
        <p className="mt-3 text-[12.5px] text-brand-muted">
          {nonRanges === 1
            ? '1 document n’a pas encore de domaine'
            : `${nonRanges} documents n’ont pas encore de domaine`}{' '}
          — vous pouvez le choisir au dépôt.
        </p>
      )}
    </div>
  )
}
