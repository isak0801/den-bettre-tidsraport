// Service worker för IHMT Tidrapport: gör appen installerbar, fungerar vid dålig täckning
// och visar snölarmet som notis även när appen är stängd.
const CACHE = 'ihmt-tid-v1';
const FILER = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILER)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nycklar) => Promise.all(nycklar.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Nätverket först (så att uppdateringar syns direkt), cache som reserv.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((svar) => {
        const kopia = svar.clone();
        caches.open(CACHE).then((c) => c.put(req, kopia));
        return svar;
      })
      .catch(() => caches.match(req).then((s) => s || caches.match('./index.html')))
  );
});

// Snölarm (skickas från GitHub Actions via Firebase Cloud Messaging)
self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) {}
  const d = p.data || p.notification || p;
  event.waitUntil(
    self.registration.showNotification(d.title || 'Snölarm', {
      body: d.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'snolarm',
      renotify: true,
      data: { link: d.link || './' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fonster) => {
      for (const f of fonster) if ('focus' in f) return f.focus();
      return clients.openWindow(link);
    })
  );
});
