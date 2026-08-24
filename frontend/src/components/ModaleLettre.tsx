import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ApiError, documentsApi } from '../services/api'
import type { LettreIA } from '../types'

interface ModaleLettreProps {
  documentId: string
  kind: 'resiliation' | 'contestation'
  /** Le gabarit `mailto:` de repli, si l'IA échoue. */
  actionTo: string
  onClose: () => void
}

type Etat =
  | { statut: 'chargement' }
  | { statut: 'pret'; lettre: LettreIA }
  | { statut: 'erreur'; message: string }

/**
 * Le brouillon rédigé par l'IA, à relire avant de l'envoyer.
 *
 * Jamais expédié depuis l'application : copier, ouvrir dans son client mail,
 * ou — si l'IA n'est pas disponible — reprendre le gabarit standard déjà
 * préparé côté client. Dans les trois cas, c'est l'utilisateur qui envoie.
 */
export default function ModaleLettre({ documentId, kind, actionTo, onClose }: ModaleLettreProps) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })
  const [copie, setCopie] = useState(false)

  useEffect(() => {
    let vivant = true
    documentsApi
      .draftLetter(documentId, kind)
      .then((lettre) => { if (vivant) setEtat({ statut: 'pret', lettre }) })
      .catch((err) => {
        if (!vivant) return
        const message = err instanceof ApiError ? err.message : 'La rédaction a échoué'
        setEtat({ statut: 'erreur', message })
      })
    return () => { vivant = false }
  }, [documentId, kind])

  async function copier(lettre: LettreIA) {
    try {
      await navigator.clipboard.writeText(`${lettre.subject}\n\n${lettre.body}`)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      // Le presse-papiers peut être refusé par le navigateur : le texte
      // reste sélectionnable à la main dans la zone ci-dessous.
    }
  }

  function lienMail(lettre: LettreIA): string {
    return `mailto:?subject=${encodeURIComponent(lettre.subject)}&body=${encodeURIComponent(lettre.body)}`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-lettre"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-[0_20px_60px_-15px_rgba(11,46,47,0.35)]"
      >
        <h2 id="titre-lettre" className="font-heading text-lg font-semibold text-brand-deep">
          {kind === 'resiliation' ? 'Lettre de résiliation' : 'Lettre de contestation'}
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          Un brouillon à relire et compléter — rien n'est envoyé depuis SYNeco.
        </p>

        {etat.statut === 'chargement' && (
          <div className="my-8 flex items-center justify-center gap-2 text-sm text-brand-muted">
            <Loader2 size={16} className="animate-spin" />
            Rédaction en cours...
          </div>
        )}

        {etat.statut === 'erreur' && (
          <div className="my-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">
            <p>{etat.message}</p>
            <a
              href={actionTo}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-brand-green hover:underline"
            >
              Utiliser le modèle standard à la place
            </a>
          </div>
        )}

        {etat.statut === 'pret' && (
          <div className="my-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-muted">Objet</label>
              <input
                type="text"
                value={etat.lettre.subject}
                onChange={(e) => setEtat({ statut: 'pret', lettre: { ...etat.lettre, subject: e.target.value } })}
                className="w-full rounded-md border border-brand-border px-3 py-2 text-sm text-brand-ink"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-muted">Corps du courrier</label>
              <textarea
                value={etat.lettre.body}
                onChange={(e) => setEtat({ statut: 'pret', lettre: { ...etat.lettre, body: e.target.value } })}
                rows={10}
                className="w-full rounded-md border border-brand-border px-3 py-2 text-sm text-brand-ink"
              />
            </div>
          </div>
        )}

        {/* Sur téléphone les boutons s'empilent : côte à côte, leurs
            intitulés seraient tronqués. */}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-brand-border px-4 py-2.5 text-sm font-medium text-brand-deep hover:bg-brand-mint"
          >
            Fermer
          </button>
          {etat.statut === 'pret' && (
            <>
              <button
                onClick={() => copier(etat.lettre)}
                className="rounded-md border border-brand-border px-4 py-2.5 text-sm font-medium text-brand-deep hover:bg-brand-mint"
              >
                {copie ? 'Copié !' : 'Copier'}
              </button>
              <a
                href={lienMail(etat.lettre)}
                target="_blank"
                rel="noopener noreferrer"
                className="brand-gradient rounded-md px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Ouvrir dans mon client mail
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
