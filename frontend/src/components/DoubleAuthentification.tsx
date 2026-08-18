import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { ApiError, deuxFacteursApi } from '../services/api'
import type { EtatDeuxiemeFacteur, PreparationDeuxiemeFacteur } from '../types'

/*
 * Double authentification : activation, retrait, codes de secours.
 *
 * Le mot de passe seul protège mal — il se réutilise d'un site à l'autre, et
 * il fuite ailleurs que chez nous. Cette page est le seul endroit où un
 * utilisateur peut ajouter un second verrou, et le seul où il voit ses codes
 * de secours : ils ne sont montrés qu'une fois, au moment où ils sont créés.
 */

type Etape = 'repos' | 'reglage' | 'codes'

function laDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function DoubleAuthentification() {
  const [etat, setEtat] = useState<EtatDeuxiemeFacteur | null>(null)
  const [etape, setEtape] = useState<Etape>('repos')
  const [preparation, setPreparation] = useState<PreparationDeuxiemeFacteur | null>(null)
  const [codesDeSecours, setCodesDeSecours] = useState<string[] | null>(null)
  const [code, setCode] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [retraitOuvert, setRetraitOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    deuxFacteursApi
      .etat()
      .then(setEtat)
      .catch(() => setEtat(null))
  }, [])

  function reinitialiser() {
    setEtape('repos')
    setPreparation(null)
    setCode('')
    setMotDePasse('')
    setRetraitOuvert(false)
    setErreur(null)
  }

  async function commencer() {
    setErreur(null)
    setEnCours(true)
    try {
      setPreparation(await deuxFacteursApi.preparer())
      setEtape('reglage')
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'L’activation n’a pas abouti')
    } finally {
      setEnCours(false)
    }
  }

  async function activer(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      const { codesDeSecours: codes } = await deuxFacteursApi.activer(code)
      setCodesDeSecours(codes)
      setEtape('codes')
      setCode('')
      setEtat(await deuxFacteursApi.etat())
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Code refusé')
    } finally {
      setEnCours(false)
    }
  }

  async function retirer(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      await deuxFacteursApi.retirer(motDePasse, code)
      setEtat(await deuxFacteursApi.etat())
      setCodesDeSecours(null)
      reinitialiser()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Le retrait n’a pas abouti')
    } finally {
      setEnCours(false)
    }
  }

  async function renouveler(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      const { codesDeSecours: codes } = await deuxFacteursApi.renouvelerLesCodes(
        motDePasse,
        code,
      )
      setCodesDeSecours(codes)
      setEtape('codes')
      setCode('')
      setMotDePasse('')
      setEtat(await deuxFacteursApi.etat())
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Le renouvellement n’a pas abouti')
    } finally {
      setEnCours(false)
    }
  }

  if (!etat) return null

  const champCode = (
    <div>
      <label htmlFor="code-2fa" className="mb-1 block text-sm font-medium text-brand-deep">
        Code à six chiffres
      </label>
      <input
        id="code-2fa"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
        placeholder="000000"
      />
    </div>
  )

  return (
    <div className="rounded-[14px] border border-brand-border bg-white px-5 py-5">
      <div className="flex items-start gap-2.5">
        {etat.actif ? (
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-green" />
        ) : (
          <ShieldOff size={18} className="mt-0.5 shrink-0 text-brand-muted" />
        )}
        <div className="min-w-0">
          <h2 className="font-heading text-[15.5px] font-semibold text-brand-ink">
            Double authentification
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted">
            {etat.actif
              ? `Active depuis le ${laDate(etat.activeeLe)}. La connexion demande votre mot de passe, puis un code à six chiffres.`
              : 'Un code à usage unique, en plus du mot de passe. Un mot de passe qui a fuité ne suffit alors plus à entrer dans votre compte.'}
          </p>
        </div>
      </div>

      {!etat.disponible && (
        <p className="mt-3 text-[13px] text-brand-amber">
          Cette protection n’est pas configurée sur ce serveur.
        </p>
      )}

      {erreur && <p className="mt-2 text-xs text-brand-danger">{erreur}</p>}

      {/* Les codes de secours ne s'affichent qu'ici, et une seule fois. */}
      {etape === 'codes' && codesDeSecours && (
        <div className="mt-4 rounded-[10px] border border-brand-amber/50 bg-amber-50/60 px-4 py-4">
          <p className="text-[13.5px] font-semibold text-brand-ink">
            Notez ces codes maintenant
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-brand-muted">
            Ils remplacent le code de votre téléphone si vous le perdez. Chacun ne sert
            qu’une fois, et ils ne seront plus jamais affichés.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[13px] text-brand-ink">
            {codesDeSecours.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setCodesDeSecours(null)
              reinitialiser()
            }}
            className="mt-4 flex items-center justify-center gap-2 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white"
          >
            <Check size={15} />
            Je les ai notés
          </button>
        </div>
      )}

      {etape === 'repos' && !etat.actif && etat.disponible && (
        <button
          type="button"
          onClick={commencer}
          disabled={enCours}
          className="mt-3 flex items-center justify-center gap-2 rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-mint disabled:opacity-60"
        >
          {enCours && <Loader2 size={15} className="animate-spin" />}
          Activer la double authentification
        </button>
      )}

      {etape === 'reglage' && preparation && (
        <form onSubmit={activer} className="mt-4">
          <p className="text-[13.5px] leading-relaxed text-brand-muted">
            Scannez ce code avec votre application d’authentification — Google
            Authenticator, Aegis, 1Password ou une autre — puis recopiez le code
            qu’elle affiche.
          </p>
          <img
            src={preparation.qrCode}
            alt="Code à scanner avec votre application d’authentification"
            className="mt-3 h-44 w-44 max-w-full rounded-[10px] border border-brand-border"
          />
          <p className="mt-3 text-[13px] text-brand-muted">
            Impossible de scanner ? Saisissez cette clé à la main :
          </p>
          {/* break-all : cette clé fait trente-deux caractères sans espace, et
              déborderait de l'écran d'un téléphone sans cette césure. */}
          <p className="mt-1 font-mono text-[12.5px] break-all text-brand-ink">
            {preparation.secret}
          </p>

          <div className="mt-4">{champCode}</div>

          {/* Empilés sur téléphone : côte à côte, les intitulés seraient tronqués. */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={enCours || code.length === 0}
              className="flex items-center justify-center gap-2 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {enCours && <Loader2 size={15} className="animate-spin" />}
              Confirmer l’activation
            </button>
            <button
              type="button"
              onClick={reinitialiser}
              disabled={enCours}
              className="rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-muted hover:bg-brand-mint disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {etape === 'repos' && etat.actif && (
        <>
          <p className="mt-3 text-[13px] text-brand-muted">
            {etat.codesDeSecoursRestants} code
            {etat.codesDeSecoursRestants > 1 ? 's' : ''} de secours encore valable
            {etat.codesDeSecoursRestants > 1 ? 's' : ''}.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setRetraitOuvert(!retraitOuvert)}
              className="rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-mint"
            >
              {retraitOuvert ? 'Fermer' : 'Gérer'}
            </button>
          </div>
        </>
      )}

      {etape === 'repos' && etat.actif && retraitOuvert && (
        <form className="mt-4 border-t border-brand-border pt-4">
          <p className="text-[13.5px] leading-relaxed text-brand-muted">
            Votre mot de passe et un code sont demandés dans les deux cas : sans quoi
            un appareil resté ouvert suffirait à retirer la protection.
          </p>

          <div className="mt-3">
            <label
              htmlFor="mdp-2fa"
              className="mb-1 block text-sm font-medium text-brand-deep"
            >
              Votre mot de passe
            </label>
            <input
              id="mdp-2fa"
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            />
          </div>

          <div className="mt-3">{champCode}</div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={renouveler}
              disabled={enCours || !motDePasse || !code}
              className="rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-mint disabled:opacity-50"
            >
              Refaire mes codes de secours
            </button>
            <button
              type="button"
              onClick={retirer}
              disabled={enCours || !motDePasse || !code}
              className="rounded-md border border-brand-danger px-3 py-2 text-sm font-medium text-brand-danger hover:bg-red-50 disabled:opacity-50"
            >
              Retirer la double authentification
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
