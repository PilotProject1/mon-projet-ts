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
/*
 * Boîte de transit du partage entrant.
 *
 * Le système remet les fichiers partagés par une requête POST, que seule
 * cette couche voit passer : la page, elle, sera ouverte ensuite par une
 * navigation ordinaire. Les fichiers sont donc déposés ici le temps que
 * l'application démarre et vienne les prendre.
 */
const SHARE_CACHE = `${VERSION}-partage`
const SHARE_KEY = '/__partage-en-attente'

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
            .filter(
              (key) =>
                key !== SHELL_CACHE && key !== ASSET_CACHE && key !== SHARE_CACHE,
            )
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

/**
 * Reçoit un partage venu du système, met les fichiers de côté, et renvoie la
 * page.
 *
 * La redirection est indispensable : sans elle, l'adresse resterait sur une
 * requête POST, et un rechargement redemanderait l'envoi du formulaire.
 */
async function recevoirUnPartage(request) {
  try {
    const formulaire = await request.formData()
    const fichiers = formulaire.getAll('fichiers').filter((f) => f && f.size > 0)

    if (fichiers.length > 0) {
      const cache = await caches.open(SHARE_CACHE)
      // Un Response par fichier ne se range pas sous une même clé : on garde
      // une entrée unique par fichier, numérotée.
      await Promise.all(
        fichiers.map((fichier, i) =>
          cache.put(
            `${SHARE_KEY}/${i}`,
            new Response(fichier, {
              headers: {
                'content-type': fichier.type || 'application/octet-stream',
                'x-nom-fichier': encodeURIComponent(fichier.name || 'document'),
              },
            }),
          ),
        ),
      )
    }
  } catch {
    /* Partage illisible : la page le dira, plutôt que d'échouer ici. */
  }

  // URL absolue : Response.redirect refuse une adresse relative.
  return Response.redirect(new URL('/partage-recu', self.location.origin).href, 303)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const cible = new URL(request.url)

  if (
    request.method === 'POST' &&
    cible.origin === self.location.origin &&
    cible.pathname === '/partage-recu'
  ) {
    event.respondWith(recevoirUnPartage(request))
    return
  }

  if (request.method !== 'GET') return

  const url = cible
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
