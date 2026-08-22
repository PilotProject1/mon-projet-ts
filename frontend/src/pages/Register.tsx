import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, ApiError } from '../services/api'
import type { User } from '../types'
import BrandLogo from '../components/BrandLogo'
import AmbientBackground from '../components/AmbientBackground'
import { mesurerCompteCree } from '../utils/mesurer'
import { useTitrePage } from '../utils/useTitrePage'

interface RegisterProps {
  onLogin: (user: User) => void
}

export default function Register({ onLogin }: RegisterProps) {
  useTitrePage(
    'Créer un compte — SYNeco',
    'Ouvrez un compte gratuit : jusqu’à 10 documents, échéances suivies et rappels avant expiration.',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await authApi.register(email, password, name)
      // Compté ici seulement : au bout de l'entonnoir, quand le compte existe
      // vraiment. Mesurer l'envoi du formulaire compterait aussi les échecs.
      mesurerCompteCree()
      onLogin(user)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer le compte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-mint px-6">
      <AmbientBackground variant="auth" />

      <div className="relative z-10 w-full max-w-[440px] rounded-[28px] border border-white/60 bg-white px-6 pt-11 pb-9 shadow-[0_30px_70px_-20px_rgba(11,61,58,0.28),0_2px_8px_rgba(11,61,58,0.06)] sm:px-10">
        <div className="mb-7">
          <BrandLogo iconSize={46} wordmarkClassName="text-2xl" />
        </div>

        <h1 className="mb-1 text-lg font-semibold whitespace-nowrap text-brand-ink sm:text-xl">
          Créez votre compte
        </h1>
        <p className="mb-7 text-sm text-brand-muted">Vos documents, synchronisés. Zéro papier.</p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="mb-2 block text-[13.5px] font-semibold text-brand-deep">
              Nom
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-brand-border bg-[#FBFDFC] px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-green focus:ring-4 focus:ring-brand-green/10"
              placeholder="Votre nom"
            />
          </div>
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-brand-border bg-[#FBFDFC] px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-green focus:ring-4 focus:ring-brand-green/10"
              placeholder="8 caractères minimum"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="brand-gradient brand-btn-shadow w-full rounded-xl py-3.5 text-[15.5px] font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-brand-muted">
          En créant un compte, vous reconnaissez avoir pris connaissance de la{' '}
          <Link to="/confidentialite" className="text-brand-green hover:underline">
            politique de confidentialité
          </Link>{' '}
          et des{' '}
          <Link to="/mentions-legales" className="text-brand-green hover:underline">
            mentions légales
          </Link>
          .
        </p>

        <p className="mt-5 text-center text-sm text-brand-muted">
          Déjà un compte ?{' '}
          <Link to="/connexion" className="font-semibold text-brand-green hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
