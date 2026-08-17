import { useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { ApiError, usersApi } from '../services/api'

/*
 * Suppression définitive du compte.
 *
 * C'est l'action la plus irréversible de l'application, et la politique de
 * confidentialité la promet. Trois obstacles la séparent d'un geste
 * malheureux : il faut l'ouvrir, écrire le mot SUPPRIMER, et redonner son
 * mot de passe. Aucun n'est décoratif — le dernier protège aussi d'un jeton
 * volé, qui ne suffit donc pas à effacer les documents de quelqu'un.
 */

const CONFIRMATION = 'SUPPRIMER'

export default function SupprimerCompte({ onSupprime }: { onSupprime: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [mot, setMot] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function supprimer(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      await usersApi.supprimerMonCompte(motDePasse)
      onSupprime()
    } catch (err) {
      setErreur(
        err instanceof ApiError ? err.message : 'La suppression n’a pas abouti',
      )
      setEnCours(false)
    }
  }

  if (!ouvert) {
    return (
      <div className="rounded-[14px] border border-brand-border bg-white px-5 py-5">
        <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
          Supprimer mon compte
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">
          Vos documents, échéances, contrats, partages et factures seront effacés
          définitivement. Cette action ne peut pas être annulée.
        </p>
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="mt-3 rounded-md border border-brand-danger px-3 py-2 text-sm font-medium text-brand-danger hover:bg-red-50"
        >
          Supprimer mon compte
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={supprimer}
      className="rounded-[14px] border border-brand-danger bg-white px-5 py-5"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brand-danger" />
        <div className="min-w-0">
          <h2 className="font-heading text-[15.5px] font-semibold text-brand-danger">
            Supprimer définitivement ce compte
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">
            Tout sera effacé : documents et fichiers, échéances, contrats, partages,
            clients et factures. Un abonnement en cours est résilié au passage.
            <strong className="text-brand-ink"> Rien ne pourra être récupéré.</strong>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="confirmation" className="mb-1 block text-sm font-medium text-brand-deep">
          Écrivez {CONFIRMATION} pour confirmer
        </label>
        <input
          id="confirmation"
          type="text"
          value={mot}
          onChange={(e) => setMot(e.target.value)}
          autoComplete="off"
          className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-danger focus:outline-none"
        />
      </div>

      <div className="mt-3">
        <label htmlFor="mdp-suppression" className="mb-1 block text-sm font-medium text-brand-deep">
          Votre mot de passe
        </label>
        <input
          id="mdp-suppression"
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-danger focus:outline-none"
        />
      </div>

      {erreur && <p className="mt-2 text-xs text-brand-danger">{erreur}</p>}

      {/* Empilés sur téléphone : côte à côte, les deux intitulés seraient
          tronqués, et celui qui efface ne doit jamais être ambigu. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={mot !== CONFIRMATION || motDePasse.length === 0 || enCours}
          className="flex items-center justify-center gap-2 rounded-md bg-brand-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Trash2 size={15} />
          {enCours ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(false)
            setMot('')
            setMotDePasse('')
            setErreur(null)
          }}
          disabled={enCours}
          className="rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-muted hover:bg-brand-mint disabled:opacity-60"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
