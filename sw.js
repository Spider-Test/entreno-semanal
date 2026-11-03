// Guarda la app en el dispositivo para poder abrirla sin conexión.
// Sube VERSION al cambiar cualquier archivo para que los dispositivos se actualicen.
const VERSION = "entreno-v1";
const ARCHIVOS = ["./", "./index.html", "./manifest.webmanifest", "./icono-180.png", "./icono-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero lo guardado (rápido y sin conexión) y, de fondo, se actualiza desde la red
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const guardado = await cache.match(req, { ignoreSearch: true });
      const red = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => guardado);
      return guardado || red;
    })
  );
});
