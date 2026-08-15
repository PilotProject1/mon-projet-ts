/*
 * Service worker minimal de SYNeco.
 *
 * Objectif : rendre l'application installable et supportable en réseau
 * dégradé, sans jamais servir une version périmée de l'interface.
 *
 * Règles retenues :
 *  - les navigations passent par le réseau d'abord ; le cache ne sert que de
 *    secours hors ligne, sinon un déploiement resterait invisible ;
 *  - les fichiers de /assets/ portent une empreinte dans leur nom : ils sont
 *    immuables, donc lisibles depuis le cache sans revalidation ;
 *  - rien de ce qui sort de l'origine n'est intercepté. L'API, Stripe et les
 *    documents stockés doivent toujours atteindre le réseau : les mettre en
 *    cache exposerait des données personnelles sur l'appareil.
 */

const VERSION = 'syneco-v1'
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`

const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/syneco-logo.png',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Réseau d'abord : la réponse fraîche remplace le secours conservé en cache. */
async function networkFirstDocument(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE)
      // La coquille est indexée sur « / » : toutes les routes de l'application
      // renvoient le même index.html.
      cache.put('/', response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match('/')
    if (cached) return cached
    throw error
  }
}

/** Cache d'abord : réservé aux fichiers dont le nom contient une empreinte. */
async function cacheFirstAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(request))
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(request))
  }
})

/*
 * Notifications push.
 *
 * Le contenu arrive chiffré depuis le serveur : le service de notification du
 * navigateur (Google, Mozilla, Apple) l'achemine sans pouvoir le lire.
 */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    /* charge utile illisible : on affiche quand même quelque chose d'utile */
  }

  const title = payload.title || 'SYNeco'
  const options = {
    body: payload.body || 'Une échéance approche.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    lang: 'fr',
    // Une notification de même étiquette remplace la précédente au lieu de
    // s'empiler : un rappel répété ne sature pas l'écran verrouillé.
    tag: payload.tag || 'syneco',
    data: { url: payload.url || '/echeances' },
  }

  // waitUntil est obligatoire : sans lui, le navigateur peut arrêter le
  // service worker avant l'affichage, et certains sanctionnent une
  // notification promise puis jamais montrée.
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/echeances', self.location.origin)

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      // Rouvrir un onglet déjà ouvert plutôt que d'en empiler un nouveau.
      for (const client of clientList) {
        if (new URL(client.url).origin === target.origin && 'focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(target.href)
          return
        }
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})
