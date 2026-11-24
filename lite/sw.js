/* Waterline Lite service worker — network first, cache as the offline fallback.
   Plan data never goes through the cache: Supabase is another origin. */
const CACHE = "waterline-lite-v1";
const SHELL = ["/lite/", "/lite/index.html", "/lite/app.js", "/lite/engine.js", "/lite/icon.svg", "/lite/icon-192.png", "/lite/manifest.webmanifest"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith("waterline-lite-") && x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/config.js")) return;
  e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("/lite/index.html"))));
});
