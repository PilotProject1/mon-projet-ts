import { useEffect, useState } from 'react'
import { BellRing, Loader2 } from 'lucide-react'
import type { NotificationPreferences } from '../types'
import { ApiError, notificationsApi } from '../services/api'

/**
 * Réglage des rappels par e-mail.
 *
 * Placé sur la page Échéances plutôt que dans un écran de réglages : c'est
 * là que la question se pose, et l'e-mail qui part renvoie sur cette page.
 */
export default function ReminderSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    notificationsApi
      .getPreferences()
      .then((value) => {
        if (!cancelled) setPreferences(value)
      })
      .catch(() => {
        /* le réglage est secondaire : son échec ne doit rien bloquer */
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!preferences) return null

  async function handleToggle() {
    if (!preferences) return
    const next = !preferences.emailReminders
    setSaving(true)
    setError(null)
    try {
      setPreferences(await notificationsApi.updatePreferences(next))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réglage non enregistré')
    } finally {
      setSaving(false)
    }
  }

  const active = preferences.emailReminders

  return (
    <div className="mb-6 rounded-lg border border-brand-border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-deep">
            <BellRing size={16} className="shrink-0 text-brand-green" />
            Rappels par e-mail
          </p>
          <p className="mt-0.5 text-xs text-brand-muted">
            Un e-mail 30 jours, 7 jours et 1 jour avant l'échéance, puis le jour même. Les rappels
            restent consultables ici quoi qu'il arrive.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label="Rappels par e-mail"
          onClick={handleToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            active ? 'bg-brand-green' : 'bg-brand-border'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              active ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {saving && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-brand-muted">
          <Loader2 size={12} className="animate-spin" />
          Enregistrement...
        </p>
      )}
      {error && <p className="mt-2 text-xs text-brand-danger">{error}</p>}

      {/* Mieux vaut le dire que laisser croire qu'un e-mail va partir. */}
      {active && !preferences.emailConfigured && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Aucun serveur d'envoi n'est configuré pour le moment : les rappels apparaissent dans
          l'application, mais aucun e-mail ne part encore.
        </p>
      )}
    </div>
  )
}
