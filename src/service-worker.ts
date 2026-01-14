import { precacheAndRoute } from 'workbox-precaching';

declare const self: any;

precacheAndRoute(self.__WB_MANIFEST || []);

const CACHE_NAME = 'trollcity-cache-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('message', (event: any) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SKIP_WAITING') {
    (self as any).skipWaiting();
  }
});

self.addEventListener('install', (event: any) => {
  // Activate immediately
  (self as any).skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]).catch(() => {}))
  );
});

self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    (async () => {
      try {
        // Claim clients so the SW takes control immediately
        await (self as any).clients.claim();
      } catch {
        // ignore
      }
      // Try to enable navigation preload only when it's safe
      try {
        if ((self as any).registration && (self as any).registration.navigationPreload && (self as any).registration.active) {
          try {
            await (self as any).registration.navigationPreload.enable();
          } catch {
            // swallow navigation preload errors
          }
        }
      } catch {
        // ignore
      }
    })()
  );
});

self.addEventListener('fetch', (event: any) => {
  const req = event.request;

  // Navigation requests: network-first with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preloadResp = await event.preloadResponse;
          if (preloadResp) return preloadResp;

          const networkResp = await fetch(req);
          return networkResp;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(OFFLINE_URL);
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // For other requests: try network then cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Put a copy in cache (best-effort)
        try {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        } catch {}
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// Simple push handler
self.addEventListener('push', (event: any) => {
  let data = {} as any;
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      try {
        data = { body: event.data.text() };
      } catch {
        data = {};
      }
    }
  }

  const title = data.title || 'Troll City Notification';
  const options: any = {
    body: data.body || 'New update from Troll City!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: data.url || '/',
    vibrate: [200, 100, 200],
  };

  event.waitUntil((self as any).registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if ((self as any).clients.openWindow) {
        return (self as any).clients.openWindow(event.notification.data || '/');
      }
    })
  );
});

self.addEventListener('message', (event: any) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    self.skipWaiting();
  }
});
