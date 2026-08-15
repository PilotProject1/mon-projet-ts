import { useEffect, useState } from 'react'
import { BellRing, Loader2, Smartphone } from 'lucide-react'
import type { NotificationPreferences } from '../types'
import { ApiError, notificationsApi } from '../services/api'
import {
  disablePush,
  enablePush,
  readPushState,
  type PushState,
} from '../utils/pushNotifications'

/**
 * Réglages des rappels : e-mail et notifications sur l'appareil.
 *
 * Placés sur la page Échéances plutôt que dans un écran de réglages : c'est
 * là que la question se pose, et c'est là que renvoient les rappels envoyés.
 */
export default function ReminderSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [savingEmail, setSavingEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pushState, setPushState] = useState<PushState | null>(null)
  const [savingPush, setSavingPush] = useState(false)

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
    readPushState()
      .then((state) => {
        if (!cancelled) setPushState(state)
      })
      .catch(() => {
        if (!cancelled) setPushState('non-supporte')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!preferences) return null

  async function handleToggleEmail() {
    if (!preferences) return
    const next = !preferences.emailReminders
    setSavingEmail(true)
    setError(null)
    try {
      setPreferences(await notificationsApi.updatePreferences(next))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réglage non enregistré')
    } finally {
      setSavingEmail(false)
    }
  }

  async function handleTogglePush() {
    setSavingPush(true)
    setError(null)
    try {
      setPushState(pushState === 'actif' ? await disablePush() : await enablePush())
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Les notifications n'ont pas pu être modifiées sur cet appareil",
      )
    } finally {
      setSavingPush(false)
    }
  }

  const emailActive = preferences.emailReminders
  const pushActive = pushState === 'actif'
  // Le réglage est proposé dès que le navigateur et le serveur peuvent le
  // servir ; un refus antérieur se règle dans le navigateur, pas ici.
  const pushOffered = pushState !== null && pushState !== 'non-configure'
  const pushToggleable = pushState === 'actif' || pushState === 'inactif'

  return (
    <div className="mb-6 divide-y divide-brand-border rounded-lg border border-brand-border bg-white">
      <Row
        icon={<BellRing size={16} className="shrink-0 text-brand-green" />}
        title="Rappels par e-mail"
        description="30 jours, 7 jours et 1 jour avant l'échéance, puis le jour même. Les rappels restent consultables ici quoi qu'il arrive."
        checked={emailActive}
        onToggle={handleToggleEmail}
        saving={savingEmail}
        disabled={false}
      >
        {/* Mieux vaut le dire que laisser croire qu'un e-mail va partir. */}
        {emailActive && !preferences.emailConfigured && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Aucun serveur d'envoi n'est configuré pour le moment : les rappels apparaissent dans
            l'application, mais aucun e-mail ne part encore.
          </p>
        )}
      </Row>

      {pushOffered && (
        <Row
          icon={<Smartphone size={16} className="shrink-0 text-brand-green" />}
          title="Notifications sur cet appareil"
          description="Le rappel s'affiche directement sur l'écran, même application fermée. Le réglage vaut pour cet appareil uniquement."
          checked={pushActive}
          onToggle={handleTogglePush}
          saving={savingPush}
          disabled={!pushToggleable}
        >
          {pushState === 'refuse' && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Les notifications ont été refusées pour ce site. Réautorisez-les dans les réglages de
              votre navigateur, puis revenez activer l'option.
            </p>
          )}
          {pushState === 'non-supporte' && (
            <p className="mt-2 rounded-md bg-brand-mint px-3 py-2 text-xs text-brand-muted">
              Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d'abord SYNeco à
              votre écran d'accueil : les notifications ne sont possibles qu'une fois l'application
              installée.
            </p>
          )}
        </Row>
      )}

      {error && <p className="px-4 py-3 text-xs text-brand-danger">{error}</p>}
    </div>
  )
}

interface RowProps {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  saving: boolean
  disabled: boolean
  onToggle: () => void
  children?: React.ReactNode
}

function Row({
  icon,
  title,
  description,
  checked,
  saving,
  disabled,
  onToggle,
  children,
}: RowProps) {
  return (
    <div className="p-4">
      {/* Sur téléphone l'interrupteur passe sous le libellé : côte à côte, il
          écraserait le texte. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-deep">
            {icon}
            {title}
          </p>
          <p className="mt-0.5 text-xs text-brand-muted">{description}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={title}
          onClick={onToggle}
          disabled={saving || disabled}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            checked ? 'bg-brand-green' : 'bg-brand-border'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-1'
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
      {children}
    </div>
  )
}
