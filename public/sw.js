// Minimal stubbed service worker to avoid CDN Workbox import in development
self.addEventListener('install', () => {
  // activate immediately
  // @ts-expect-error sw bootstrap in dev
  if (self.skipWaiting) {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (_event) => {
  try {
    // @ts-expect-error sw clients in dev
    if (self.clients && self.clients.claim) {
      self.clients.claim();
    }
  } catch {
    // ignore
  }
});

// No-op fetch handler — real service worker is built from src/service-worker.ts
self.addEventListener('fetch', () => {});
