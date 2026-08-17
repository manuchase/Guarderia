const CACHE_NAME = "skillmind-shell-v1";
const SHELL_FILES = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon-512-mono.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Solo cacheamos el "cascarón" de la app (HTML/manifest/íconos).
// Todo lo demás (y sobre todo las llamadas a Supabase) siempre va directo a la red,
// para que los datos de la guardería nunca se sirvan desde una copia vieja guardada.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isShellFile = SHELL_FILES.includes(url.pathname);

  if (event.request.method !== "GET" || url.origin !== self.location.origin || !isShellFile) {
    return; // deja pasar todo lo demás directo a la red (Supabase, JS, CSS, etc.)
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
