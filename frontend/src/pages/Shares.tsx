import { useState } from 'react'
import type { ShareLink } from '../types'
import { ApiError } from '../services/api'
import { formatDate } from '../utils/formatDate'

interface SharesProps {
  shares: ShareLink[]
  onRevoke: (id: string) => Promise<void>
}

function getStatus(share: ShareLink): { label: string; className: string } {
  if (share.revokedAt) {
    return { label: 'Révoqué', className: 'bg-gray-100 text-gray-600' }
  }
  if (new Date(share.expiresAt).getTime() < Date.now()) {
    return { label: 'Expiré', className: 'bg-amber-100 text-amber-700' }
  }
  return { label: 'Actif', className: 'bg-green-100 text-green-700' }
}

export default function Shares({ shares, onRevoke }: SharesProps) {
  const [error, setError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function handleRevoke(id: string) {
    setError(null)
    setRevokingId(id)
    try {
      await onRevoke(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de révoquer ce lien')
    } finally {
      setRevokingId(null)
    }
  }

  async function handleCopy(share: ShareLink) {
    const url = `${window.location.origin}/partage/${share.token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(share.id)
      setTimeout(() => setCopiedId((current) => (current === share.id ? null : current)), 2000)
    } catch {
      setError('Impossible de copier le lien automatiquement, copie-le manuellement.')
    }
  }

  return (
    <div>
      <h1 className="font-heading mb-6 text-[28px] font-semibold text-brand-deep">Partages</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-lg border border-brand-border bg-white">
        {shares.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-muted">
            Aucun lien de partage. Depuis la page Documents, clique sur "Partager" pour en créer
            un.
          </p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {shares.map((share) => {
              const status = getStatus(share)
              const isActive = status.label === 'Actif'
              return (
                <li key={share.id} className="flex flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">{share.documentName}</p>
                    <p className="text-xs text-brand-muted">
                      Créé le {formatDate(share.createdAt)} · Expire le{' '}
                      {formatDate(share.expiresAt)} · {share.accessCount} accès
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:shrink-0">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                    {isActive && (
                      <>
                        <button
                          onClick={() => handleCopy(share)}
                          className="text-sm text-brand-muted hover:text-brand-green"
                        >
                          {copiedId === share.id ? 'Copié !' : 'Copier le lien'}
                        </button>
                        <button
                          onClick={() => handleRevoke(share.id)}
                          disabled={revokingId === share.id}
                          className="text-sm text-brand-muted hover:text-brand-danger disabled:opacity-60"
                        >
                          {revokingId === share.id ? 'Révocation...' : 'Révoquer'}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
