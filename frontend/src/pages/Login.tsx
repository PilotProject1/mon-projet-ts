import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, ApiError } from '../services/api'
import type { User } from '../types'
import BrandLogo from '../components/BrandLogo'
import AmbientBackground from '../components/AmbientBackground'
import { useTitrePage } from '../utils/useTitrePage'

interface LoginProps {
  onLogin: (user: User) => void
}

/*
 * La connexion se fait en un temps, ou en deux si le compte est protégé par
 * un code. Le second temps reste dans la même carte : changer de page ferait
 * perdre le fil, et le jeton de défi ne vaut que quelques minutes.
 */
export default function Login({ onLogin }: LoginProps) {
  useTitrePage(
    'Connexion — SYNeco',
    'Accédez à vos documents administratifs, vos échéances et vos rappels SYNeco.',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [defi, setDefi] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const resultat = await authApi.login(email, password)
      if ('deuxiemeFacteurRequis' in resultat) {
        setDefi(resultat.challengeToken)
        setPassword('')
        return
      }
      onLogin(resultat.user)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de se connecter')
    } finally {
      setLoading(false)
    }
  }

  async function envoyerLeCode(e: FormEvent) {
    e.preventDefault()
    if (!defi) return
    setError(null)
    setLoading(true)
    try {
      const user = await authApi.loginDeuxiemeFacteur(defi, code)
      onLogin(user)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de se connecter')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  function recommencer() {
    setDefi(null)
    setCode('')
    setError(null)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-mint px-6">
      <AmbientBackground variant="auth" />

      <div className="relative z-10 w-full max-w-[440px] rounded-[28px] border border-white/60 bg-white px-6 pt-11 pb-9 shadow-[0_30px_70px_-20px_rgba(11,61,58,0.28),0_2px_8px_rgba(11,61,58,0.06)] sm:px-10">
        <div className="mb-7">
          <BrandLogo iconSize={46} wordmarkClassName="text-2xl" />
        </div>

        {defi ? (
          <>
            <h1 className="mb-1 text-lg font-semibold text-brand-ink sm:text-xl">
              Code de vérification
            </h1>
            <p className="mb-7 text-sm text-brand-muted">
              Ouvrez votre application d’authentification et recopiez le code affiché.
            </p>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={envoyerLeCode} className="space-y-5">
              <div>
                <label
                  htmlFor="code"
                  className="mb-2 block text-[13.5px] font-semibold text-brand-deep"
                >
                  Code à six chiffres
                </label>
                {/* inputMode fait apparaître le pavé numérique sur téléphone, et
                    autoComplete propose le code quand le système le connaît. */}
                <input
                  id="code"
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-[#FBFDFC] px-4 py-3 text-center text-lg tracking-[0.4em] text-brand-ink outline-none transition focus:border-brand-green focus:ring-4 focus:ring-brand-green/10"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="brand-gradient brand-btn-shadow w-full rounded-xl py-3.5 text-[15.5px] font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {loading ? 'Vérification...' : 'Valider'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-brand-muted">
              Téléphone indisponible ? Saisissez l’un de vos codes de secours.
            </p>
            <p className="mt-2 text-center text-sm">
              <button
                type="button"
                onClick={recommencer}
                className="font-semibold text-brand-green hover:underline"
              >
                Revenir à la connexion
              </button>
            </p>
          </>
        ) : (
          <>
          <h1 className="mb-1 text-lg font-semibold whitespace-nowrap text-brand-ink sm:text-xl">
            Connectez-vous à votre espace
          </h1>
          <p className="mb-7 text-sm text-brand-muted">Vos documents, synchronisés. Zéro papier.</p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-[13.5px] font-semibold text-brand-deep">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-brand-border bg-[#FBFDFC] px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-green focus:ring-4 focus:ring-brand-green/10"
                placeholder="vous@exemple.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[13.5px] font-semibold text-brand-deep"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-brand-border bg-[#FBFDFC] px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-green focus:ring-4 focus:ring-brand-green/10"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="brand-gradient brand-btn-shadow w-full rounded-xl py-3.5 text-[15.5px] font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-brand-muted">
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="font-semibold text-brand-green hover:underline">
              Créer un compte
            </Link>
          </p>
          </>
        )}

        <p className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-brand-muted">
          <Link to="/mentions-legales" className="hover:text-brand-green hover:underline">
            Mentions légales
          </Link>
          <Link to="/confidentialite" className="hover:text-brand-green hover:underline">
            Confidentialité
          </Link>
        </p>
      </div>
    </div>
  )
}
