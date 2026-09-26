// Service worker minimal : il rend le jeu installable et garde une copie des
// fichiers pour démarrer vite. La page est toujours demandée d'abord au réseau
// (réseau d'abord), pour qu'une nouvelle version soit prise aussitôt ; les
// fichiers compilés, dont le nom change à chaque version, viennent du cache.
// Les icônes n'y sont pas : elles gardent leur nom d'une version à l'autre.
const CACHE = 'boomz-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Rien à faire pour le jeu en ligne (WebSocket), les statistiques ou un autre site.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/stats')) return;
  if (request.mode === 'navigate') {
    // Réseau lent ou absent : passé 3 s, on
    // affiche la copie gardée en cache (le jeu indique alors qu'il se connecte).
    const network = fetch(request).then((response) => {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put('/', copy));
      return response;
    });
    const fallback = new Promise((resolve) => setTimeout(resolve, 3000)).then(() => caches.match('/'));
    event.respondWith(
      Promise.race([network, fallback.then((cached) => cached ?? network)]).catch(() =>
        caches.match('/').then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
