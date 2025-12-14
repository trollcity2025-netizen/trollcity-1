// Disabled aggressive PWA caching - network only
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear all caches
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => caches.delete(key)))
      )
    ])
  );
});

// Network-only for everything
self.addEventListener("fetch", (event) => {
  // Do nothing - let browser handle normally
});
