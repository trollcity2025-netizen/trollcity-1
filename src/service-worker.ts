import { precacheAndRoute } from 'workbox-precaching';

declare const self: any;

precacheAndRoute(self.__WB_MANIFEST || []);

const CACHE_NAME = 'trollcity-cache-v3';
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
        
        // Cleanup old caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
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
  const url = new URL(req.url);

  // CRITICAL: Bypass Service Worker for all streaming and large asset requests
  // This ensures HLS streams are never intercepted or cached by the SW
  // NetworkOnly explicitly
  if (
    url.pathname.startsWith('/streams/') ||
    url.pathname.includes('.m3u8') ||
    url.pathname.includes('.ts') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.startsWith('/assets/')
  ) {
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preloadResp = await event.preloadResponse;
          if (preloadResp) return preloadResp;
        } catch {
          // Preload failed, proceed to network
        }

        try {
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

  // For other requests: network-only for API, network-first for assets
  
  // API requests should never be cached by SW
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(fetch(req));
    return;
  }

  // Static assets: Stale-while-revalidate or Network First
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        // Cache valid responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
           const resClone = networkResponse.clone();
           caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        }
        return networkResponse;
      }).catch(() => {
         // Network failed, return cached if available, else offline
         return cachedResponse || caches.match(OFFLINE_URL);
      });
      
      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
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
    (self as any).skipWaiting?.();
  }
});
