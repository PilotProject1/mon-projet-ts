import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import AmbientBackground from '../components/AmbientBackground'
import { ApiError, publicSharesApi } from '../services/api'
import type { PublicShareInfo } from '../types'
import { formatDate } from '../utils/formatDate'

const typeLabels: Record<string, string> = {
  contrat: 'Contrat',
  facture: 'Facture',
  assurance: 'Assurance',
  garantie: 'Garantie',
  courrier: 'Courrier',
  autre: 'Document',
}

export default function PublicShare() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<PublicShareInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (!token) return
    publicSharesApi
      .getInfo(token)
      .then(setInfo)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Ce lien de partage est invalide.')
      })
      .finally(() => setLoading(false))
  }, [token])

  async function handleView() {
    if (!token) return
    setOpening(true)
    setError(null)
    try {
      const blob = await publicSharesApi.getFileBlob(token)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ouvrir le document")
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-mint px-6">
      <AmbientBackground variant="auth" />

      <div className="relative z-10 w-full max-w-[440px] rounded-[28px] border border-white/60 bg-white px-10 pb-9 pt-11 shadow-[0_30px_70px_-20px_rgba(11,61,58,0.28),0_2px_8px_rgba(11,61,58,0.06)]">
        <div className="mb-7">
          <BrandLogo iconSize={46} wordmarkClassName="text-2xl" />
        </div>

        {loading && <p className="text-sm text-brand-muted">Vérification du lien...</p>}

        {!loading && error && (
          <>
            <h1 className="mb-2 text-xl font-semibold text-brand-ink">Lien indisponible</h1>
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          </>
        )}

        {!loading && info && !error && (
          <>
            <h1 className="mb-1 text-xl font-semibold text-brand-ink">Document partagé</h1>
            <p className="mb-6 text-sm text-brand-muted">
              Quelqu'un a partagé un document avec toi via SYNeco.
            </p>

            <div className="mb-6 rounded-xl border border-brand-border bg-brand-mint/40 p-4">
              <p className="text-sm font-medium text-brand-ink">{info.documentName}</p>
              <p className="text-xs text-brand-muted">
                {typeLabels[info.documentType] ?? info.documentType} · Lien valide jusqu'au{' '}
                {formatDate(info.expiresAt)}
              </p>
            </div>

            <button
              onClick={handleView}
              disabled={opening}
              className="brand-gradient brand-btn-shadow w-full rounded-xl py-3.5 text-[15.5px] font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {opening ? 'Ouverture...' : 'Voir le document'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
