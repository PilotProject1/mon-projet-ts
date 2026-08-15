/*
 * Abonnement du navigateur aux notifications push.
 *
 * Tout est conditionnel : le service worker, l'API Push et la permission
 * peuvent manquer indépendamment les uns des autres. Chaque état est distingué
 * pour que l'interface dise ce qui bloque, plutôt qu'un « indisponible »
 * opaque.
 */
import { pushApi } from '../services/api'

export type PushState =
  | 'non-supporte'
  | 'refuse'
  | 'inactif'
  | 'actif'
  | 'non-configure'

/** L'API Push suppose un service worker, absent en développement. */
export function pushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * La clé publique VAPID voyage en base64 « URL-safe » ; l'API attend des
 * octets bruts.
 */
function decodePublicKey(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  // Un ArrayBuffer explicite : Uint8Array peut reposer sur une mémoire
  // partagée, que l'API d'abonnement refuse.
  const buffer = new ArrayBuffer(raw.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return buffer
}

/** Nom d'appareil lisible, pour que l'utilisateur s'y retrouve. */
function deviceLabel(): string {
  const ua = navigator.userAgent
  const systeme = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Mac/i.test(ua)
        ? 'Mac'
        : /Windows/i.test(ua)
          ? 'Windows'
          : 'Appareil'
  const navigateur = /Firefox/i.test(ua)
    ? 'Firefox'
    : /Edg/i.test(ua)
      ? 'Edge'
      : /Chrome/i.test(ua)
        ? 'Chrome'
        : /Safari/i.test(ua)
          ? 'Safari'
          : 'navigateur'
  return `${systeme} · ${navigateur}`
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

/** État courant, sans rien demander à l'utilisateur. */
export async function readPushState(): Promise<PushState> {
  if (!pushSupported()) return 'non-supporte'
  const { available } = await pushApi.getPublicKey()
  if (!available) return 'non-configure'
  if (Notification.permission === 'denied') return 'refuse'
  return (await currentSubscription()) ? 'actif' : 'inactif'
}

/**
 * Demande l'autorisation puis abonne l'appareil.
 * Le refus n'est pas une erreur : c'est un état, rendu tel quel.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'non-supporte'

  const { publicKey, available } = await pushApi.getPublicKey()
  if (!available || !publicKey) return 'non-configure'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'refuse'

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Obligatoire : le navigateur exige qu'un push donne toujours lieu à une
      // notification visible, jamais à un traitement silencieux.
      userVisibleOnly: true,
      applicationServerKey: decodePublicKey(publicKey),
    }))

  const json = subscription.toJSON()
  if (!json.keys?.p256dh || !json.keys?.auth) {
    await subscription.unsubscribe().catch(() => undefined)
    return 'inactif'
  }

  await pushApi.subscribe({
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    label: deviceLabel(),
  })
  return 'actif'
}

/**
 * Retire l'abonnement des deux côtés. Le serveur est prévenu en premier :
 * si l'appel échoue, l'appareil reste abonné localement et l'utilisateur peut
 * réessayer, plutôt que de continuer à recevoir des notifications qu'il ne
 * pourrait plus couper.
 */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return 'non-supporte'

  const subscription = await currentSubscription()
  if (!subscription) return 'inactif'

  await pushApi.unsubscribe(subscription.endpoint)
  await subscription.unsubscribe().catch(() => undefined)
  return 'inactif'
}
