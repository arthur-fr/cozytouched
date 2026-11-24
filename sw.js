// Service worker : l'app s'ouvre même sans réseau (coquille en cache) ; les appels aux serveurs
// Atlantic ne passent jamais par le cache.
const VERSION = 'cozytouched-1.1.0-1';
const SHELL = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png',
  'js/app.js', 'js/vdom.js', 'js/api.js', 'js/model.js', 'js/demo.js', 'js/store.js', 'js/secret.js', 'js/ui.js', 'js/nav.js',
  'js/screens/home.js', 'js/screens/room.js', 'js/screens/advanced.js', 'js/screens/program.js',
  'js/screens/absence.js', 'js/screens/devices.js', 'js/screens/shell.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'fonts').map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Icônes (Google Fonts) : cache d'abord, elles ne changent pas.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('fonts').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Fichiers de l'app : réseau d'abord (mises à jour immédiates), cache si hors ligne.
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      } catch {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('index.html');
        throw new Error('hors ligne');
      }
    })());
  }
  // Tout le reste (API Atlantic) : pas d'interception.
});
