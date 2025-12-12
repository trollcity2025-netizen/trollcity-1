const STATIC_CACHE = "trollcity-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache HTML / navigation
  if (req.mode === "navigate") {
    event.respondWith(fetch(req));
    return;
  }

  // Static assets only
  if (/\.(js|css|png|jpg|jpeg|svg|webp|gif)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(req, copy);
          });
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
