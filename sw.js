// Guarda la app en el dispositivo para poder abrirla sin conexión.
// Sube VERSION al cambiar cualquier archivo para que los dispositivos se actualicen.
const VERSION = "entreno-v21";
const ARCHIVOS = ["./", "./index.html", "./estilos.css", "./app.js", "./manifest.webmanifest", "./icono-180.png", "./icono-512.png", "./icono-maskable-192.png", "./icono-maskable-512.png"];

// GitHub Pages pide guardar los archivos 10 minutos: se piden siempre al servidor para no copiar una versión vieja
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Con conexión, siempre la última versión de cada archivo; sin conexión (o si la red tarda más de 3,5 s), la guardada
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const red = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { if (r.ok) cache.put(req, r.clone()); return r; });
    const guardado = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await cache.match("./") : undefined);
    if (!guardado) return red;
    return Promise.race([red.catch(() => guardado), new Promise(res => setTimeout(() => res(guardado), 3500))]);
  })());
});
