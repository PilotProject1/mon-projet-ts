import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { ApiError, usersApi } from '../services/api'

/*
 * Téléchargement de toutes ses données — droit à la portabilité, article 20
 * du RGPD.
 *
 * Placé juste au-dessus de la suppression du compte, et pas ailleurs : c'est
 * exactement au moment où l'on envisage de partir qu'on veut emporter ses
 * affaires. Les proposer dans cet ordre est une politesse autant qu'une
 * obligation.
 */
export default function ExporterMesDonnees() {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function telecharger() {
    setErreur(null)
    setEnCours(true)
    try {
      const blob = await usersApi.exporterMesDonnees()
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      const jour = new Date().toISOString().slice(0, 10)
      lien.download = `syneco-mes-donnees-${jour}.json`
      lien.click()
      // L'URL retient le fichier en mémoire tant qu'elle existe.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setErreur(
        err instanceof ApiError ? err.message : 'Le téléchargement n’a pas abouti',
      )
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="rounded-[14px] border border-brand-border bg-white px-5 py-5">
      <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
        Télécharger mes données
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">
        Un fichier contenant votre compte, vos documents avec ce qui en a été lu, vos
        échéances, contrats, partages, clients et factures. Les fichiers eux-mêmes se
        téléchargent depuis la liste des documents.
      </p>
      {erreur && <p className="mt-2 text-xs text-brand-danger">{erreur}</p>}
      <button
        type="button"
        onClick={telecharger}
        disabled={enCours}
        className="mt-3 flex items-center justify-center gap-2 rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-mint disabled:opacity-60"
      >
        {enCours ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        {enCours ? 'Préparation…' : 'Télécharger mes données'}
      </button>
    </div>
  )
}
