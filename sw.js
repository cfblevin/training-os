// Offline cache. App shell is precached; everything else falls back to cache.
const VERSION = 'training-os-v1.4.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/app.css',
  './styles/themes.css',
  './src/app.js',
  './src/version.js',
  './src/core/store.js',
  './src/core/actions.js',
  './src/core/schedule.js',
  './src/core/progression.js',
  './src/core/volume.js',
  './src/data/library.js',
  './src/data/program.js',
  './src/ui/dom.js',
  './src/ui/ctx.js',
  './src/ui/timer.js',
  './src/ui/pickers.js',
  './src/ui/today.js',
  './src/ui/workout.js',
  './src/ui/history.js',
  './src/ui/profile.js',
  './src/ui/settings.js',
  './src/ui/conditioning.js',
  './src/ui/blocks.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache-first for the shell so the app opens instantly and works with no network,
// with a background refresh so a new build is picked up on the next launch.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) {
      fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const fallback = await cache.match('./index.html');
      return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
