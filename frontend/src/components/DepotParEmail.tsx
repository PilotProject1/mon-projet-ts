import { useEffect, useState } from 'react'
import { Check, Copy, Mail, RefreshCw } from 'lucide-react'
import { ApiError, depotEmailApi } from '../services/api'

/*
 * L'adresse à laquelle transférer ses documents.
 *
 * Une facture arrive par e-mail : il fallait jusqu'ici télécharger la pièce
 * jointe, ouvrir le site, la redéposer. Transférer le message, c'est deux
 * gestes, et c'est fait depuis l'endroit où le document se trouve déjà.
 *
 * L'adresse contient une part secrète, et c'est elle seule qui protège le
 * compte : l'expéditeur d'un courriel se falsifie, la destination non. D'où
 * l'avertissement affiché, et le bouton qui permet d'en changer si elle a
 * été divulguée.
 */
export default function DepotParEmail() {
  const [adresse, setAdresse] = useState<string | null>(null)
  const [disponible, setDisponible] = useState<boolean | null>(null)
  const [copie, setCopie] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    depotEmailApi
      .adresse()
      .then((etat) => {
        setAdresse(etat.adresse)
        setDisponible(etat.disponible)
      })
      .catch(() => setDisponible(false))
  }, [])

  async function copier() {
    if (!adresse) return
    try {
      await navigator.clipboard.writeText(adresse)
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    } catch {
      // Le presse-papiers est refusé dans certains contextes : l'adresse
      // reste sélectionnable à la main, on ne bloque rien.
      setErreur('Copie impossible — sélectionnez l’adresse à la main')
    }
  }

  async function renouveler() {
    setErreur(null)
    setEnCours(true)
    try {
      const { adresse: nouvelle } = await depotEmailApi.regenerer()
      setAdresse(nouvelle)
      setCopie(false)
    } catch (err) {
      setErreur(
        err instanceof ApiError ? err.message : 'Le renouvellement n’a pas abouti',
      )
    } finally {
      setEnCours(false)
    }
  }

  // Tant qu'on ne sait pas, on n'affiche rien : un bloc qui apparaît puis
  // disparaît est pire qu'un bloc qui arrive une seconde plus tard.
  if (disponible === null) return null
  if (!disponible) return null

  return (
    <div className="rounded-[14px] border border-brand-border bg-white px-5 py-5">
      <div className="flex items-start gap-2.5">
        <Mail size={18} className="mt-0.5 shrink-0 text-brand-green" />
        <div className="min-w-0">
          <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
            Envoyer un document par e-mail
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">
            Transférez le message contenant votre facture à l’adresse ci-dessous. La pièce
            jointe est déposée dans votre espace et lue automatiquement.
          </p>
        </div>
      </div>

      {/* break-all : cette adresse ne comporte aucune espace et déborderait
          de l'écran d'un téléphone sans cette césure. */}
      <p className="mt-3.5 rounded-[10px] border border-brand-border bg-brand-mint/40 px-3 py-2.5 font-mono text-[12.5px] break-all text-brand-ink">
        {adresse}
      </p>

      {erreur && <p className="mt-2 text-xs text-brand-danger">{erreur}</p>}

      {/* Empilés sur téléphone : côte à côte, les deux intitulés seraient tronqués. */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void copier()}
          className="flex items-center justify-center gap-2 rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-mint"
        >
          {copie ? <Check size={15} className="text-brand-green" /> : <Copy size={15} />}
          {copie ? 'Adresse copiée' : 'Copier l’adresse'}
        </button>
        <button
          type="button"
          onClick={() => void renouveler()}
          disabled={enCours}
          className="flex items-center justify-center gap-2 rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-muted hover:bg-brand-mint disabled:opacity-60"
        >
          <RefreshCw size={15} className={enCours ? 'animate-spin' : ''} />
          Changer d’adresse
        </button>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-brand-muted">
        <strong className="text-brand-ink">Gardez cette adresse pour vous.</strong> Elle
        contient une partie secrète : qui la connaît peut déposer un document dans votre
        espace. Si vous l’avez divulguée, changez-en — l’ancienne cesse aussitôt de
        fonctionner.
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-muted">
        Seules les pièces jointes PDF, JPG, PNG et WEBP sont retenues. Beaucoup de
        fournisseurs envoient un lien plutôt qu’un fichier : dans ce cas, le transfert
        n’apportera rien.
      </p>
    </div>
  )
}
