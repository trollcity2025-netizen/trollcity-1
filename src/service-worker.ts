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
        
        // Notify all clients about the update
        const clients = await (self as any).clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: "SW_UPDATED" });
        }

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
    url.pathname.endsWith('.mp4')
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

  // For other requests: network-only for API, strict allowlist for assets
  
  // API requests should never be cached by SW
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(fetch(req));
    return;
  }

  // Strict allowlist for caching
  // Only cache: scripts, styles, images, fonts
  const isCacheableAsset = 
    req.method === 'GET' && 
    (req.destination === 'style' || 
     req.destination === 'script' || 
     req.destination === 'image' || 
     req.destination === 'font');

  if (isCacheableAsset) {
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
             // Network failed, return cached if available
             return cachedResponse;
          });
          
          // Return cached response immediately if available, otherwise wait for network
          return cachedResponse || fetchPromise;
        })
      );
  } else {
      // Everything else (non-nav, non-API, non-allowlist) → NetworkOnly
      event.respondWith(fetch(req));
  }
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
  const urlToOpen = event.notification.data || '/';

  event.waitUntil(
    (async () => {
        const clientList = await (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true });
        
        let matchingClient = null;
        for (const client of clientList) {
             if ('focus' in client) {
                 matchingClient = client;
                 break;
             }
        }

        if (matchingClient) {
            await matchingClient.focus();
            matchingClient.postMessage({ type: 'NAVIGATE', url: urlToOpen });
        } else {
            if ((self as any).clients.openWindow) {
                await (self as any).clients.openWindow(urlToOpen);
            }
        }
    })()
  );
});
