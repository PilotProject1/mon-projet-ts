// Le jeu ne se joue plus sur le site mais dans l'application. Ce service
// worker remplace celui de l'ancienne version installable : il se désinstalle
// et vide son cache, pour que la page d'accueil actuelle s'affiche.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((client) => client.navigate(client.url))),
  );
});
