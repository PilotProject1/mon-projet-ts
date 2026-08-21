import { useState } from 'react'
import { FolderPlus, Loader2 } from 'lucide-react'
import type { DocumentCategory } from '../types'
import { ApiError } from '../services/api'
import { CATEGORIES, categorie } from './categories'

/*
 * Le domaine d'un document, montré et modifiable au même endroit.
 *
 * Une pastille qui se contente d'afficher ne suffisait pas. La lecture du
 * document propose un rangement, mais elle se trompe parfois et renonce
 * souvent — et surtout, les documents déposés avant l'existence des domaines
 * n'en ont aucun. Sans ce sélecteur, il aurait fallu redéposer un fichier
 * pour le ranger, ce que personne ne fait.
 *
 * Il se montre sur toutes les lignes, y compris celles qui n'ont pas encore
 * de domaine : une case vide qui se voit est une invitation, une case vide
 * qu'on ne voit pas est un oubli.
 *
 * L'enregistrement passe par l'état de l'application, comme les autres
 * modifications : la liste, les compteurs et la répartition du tableau de
 * bord se mettent alors à jour ensemble, sans qu'on ait à les prévenir un
 * par un.
 */
export default function SelecteurCategorie({
  valeur,
  onChoisir,
}: {
  valeur: DocumentCategory | null
  onChoisir: (categorie: DocumentCategory | null) => Promise<void>
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const courante = categorie(valeur)

  async function choisir(brut: string) {
    setErreur(null)
    setEnCours(true)
    try {
      await onChoisir(brut === '' ? null : (brut as DocumentCategory))
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Rangement impossible')
    } finally {
      setEnCours(false)
    }
  }

  const teinte = courante?.teinte ?? null
  const Icone = courante?.icone ?? FolderPlus

  return (
    <span className="inline-flex flex-col">
      <span
        className="relative inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={
          teinte
            ? { background: `${teinte}14`, color: teinte }
            : {
                color: 'var(--muted)',
                boxShadow: 'inset 0 0 0 1px var(--border)',
              }
        }
      >
        {enCours ? (
          <Loader2 size={11.5} className="animate-spin" />
        ) : (
          <Icone size={11.5} strokeWidth={2.4} />
        )}
        {courante?.libelle ?? 'Ranger'}

        {/*
         * Le menu recouvre la pastille sans se voir : un <select> natif ouvre
         * la liste que l'appareil sait le mieux présenter — une roue en bas
         * de l'écran sur téléphone — là où un menu redessiné à la main se
         * serait retrouvé coupé par le bord de la ligne.
         */}
        <select
          value={valeur ?? ''}
          disabled={enCours}
          onChange={(e) => void choisir(e.target.value)}
          aria-label="Domaine du document"
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">Sans domaine</option>
          {CATEGORIES.map((c) => (
            <option key={c.cle} value={c.cle}>
              {c.libelle}
            </option>
          ))}
        </select>
      </span>

      {erreur && <span className="mt-0.5 text-[11px] text-brand-danger">{erreur}</span>}
    </span>
  )
}
