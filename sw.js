// Service Worker: legt die ganze App beim Installieren in den Cache, danach läuft sie offline.
// Antwortet sofort aus dem Cache und holt im Hintergrund die neue Fassung (gilt ab dem nächsten Start).
// Bei Änderungen an der Dateiliste VERSION hochzählen.
const VERSION = "v1";
const CACHE = "bildwandler-" + VERSION;
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "fonts/fonts.css",
  "fonts/barlow-400.woff2",
  "fonts/barlow-500.woff2",
  "fonts/barlow-600.woff2",
  "fonts/barlow-semi-condensed-500.woff2",
  "fonts/barlow-semi-condensed-600.woff2",
  "fonts/barlow-semi-condensed-700.woff2",
  "fonts/ibm-plex-mono-400.woff2",
  "fonts/ibm-plex-mono-500.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("bildwandler-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = req.mode === "navigate" ? "./" : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === "navigate" });
    const fresh = fetch(req).then(res => {
      if (res.ok && res.type === "basic") cache.put(key, res.clone());
      return res;
    });
    if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }
    return fresh;
  }));
});
