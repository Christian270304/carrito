/* Generado durante npm run build. Solo almacena archivos públicos de la aplicación. */
const CACHE = "en-casa-static-__VERSION__";
const ASSETS = __ASSETS__;
const STATIC_PATHS = new Set(ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  // Una nueva versión espera a que el usuario confirme la actualización.
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("en-casa-static-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Ni credenciales, ni perfiles, ni productos: la API SIEMPRE utiliza la red.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.status < 500) return response;
          const fallback = await caches.match("/offline.html");
          return fallback || response;
        } catch {
          return (
            (await caches.match("/offline.html")) ||
            new Response("No se pudo conectar. Vuelve a intentarlo.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }
  if (STATIC_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(url.pathname, response.clone());
        return response;
      }),
    );
  }
});
