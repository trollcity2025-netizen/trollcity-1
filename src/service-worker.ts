/// <reference lib="webworker" />

// Declare service worker scope
declare const self: ServiceWorkerGlobalScope;

// Build-time variables injected by vite-plugin-pwa
declare const __BUILD_TIME__: string;
declare const __APP_VERSION__: string;

// ===== VERSION & CACHE CONFIGURATION =====
const CACHE_VERSION = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : Date.now().toString();
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
const CACHE_PREFIX = 'trollcity';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;
const STREAM_CACHE = `${CACHE_PREFIX}-streams-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// ===== BACKGROUND SYNC QUEUES =====
interface QueuedRequest {
  url: string;
  method: string;
  headers: [string, string][];
  body: string;
  timestamp: number;
}

const SYNC_QUEUES: Record<string, QueuedRequest[]> = {
  'chat-messages': [],
  'reactions': [],
  'gifts': [],
  'follows': [],
  'profile-updates': []
};

// ===== INDEXEDDB QUEUE PERSISTENCE =====
const QUEUE_DB_NAME = 'trollcity-sw-queues';
const QUEUE_DB_VERSION = 1;
const QUEUE_STORE_NAME = 'sync-queues';

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, QUEUE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        db.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'queueName' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadPersistedQueues() {
  try {
    const db = await openQueueDB();
    const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const request = store.getAll();
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const records = request.result || [];
        for (const record of records) {
          if (record.queueName && record.items) {
            SYNC_QUEUES[record.queueName] = record.items;
          }
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    db.close();
    console.log('[SW] Loaded persisted queues');
  } catch (err) {
    console.warn('[SW] Failed to load persisted queues:', err);
  }
}

async function clearPersistedQueue(queueName: string) {
  try {
    const db = await openQueueDB();
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    store.delete(queueName);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn(`[SW] Failed to clear persisted queue ${queueName}:`, err);
  }
}

// ===== PRECACHE MANIFEST (injected by Workbox) =====
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRECACHE_MANIFEST: any[] = (self as unknown as { __WB_MANIFEST: any[] }).__WB_MANIFEST || [];

// ===== INSTALL EVENT =====
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${APP_VERSION} (${CACHE_VERSION})`);
  
  // DON'T force immediate activation - let the user stay on the current version
  // This prevents unexpected page reloads during critical moments (like broadcasts)
  // The skipWaiting will be called only when explicitly requested via message
  // self.skipWaiting();
  
  // Pre-cache critical assets
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      
      // Cache offline page and icons
      const essentialAssets = [
        OFFLINE_URL,
        '/icons/icon-72.png',
        '/icons/icon-96.png',
        '/icons/icon-128.png',
        '/icons/icon-144.png',
        '/icons/icon-152.png',
        '/icons/icon-192.png',
        '/icons/icon-256.png',
        '/icons/icon-512.png',
        '/favicon.svg'
      ];
      
      // Add manifest entries
      const manifestAssets = PRECACHE_MANIFEST.map((entry) => 
        typeof entry === 'string' ? entry : entry.url
      );
      
      const allAssets = [...essentialAssets, ...manifestAssets];
      
      await Promise.all(
        allAssets.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            console.warn(`[SW] Failed to cache: ${url}`, err);
          }
        })
      );
      
      console.log(`[SW] Cached ${allAssets.length} assets`);
    })()
  );
});

// ===== ACTIVATE EVENT =====
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${APP_VERSION}`);
  
  event.waitUntil(
    (async () => {
      // Claim clients immediately
      await self.clients.claim();
      
      // Load persisted sync queues from IndexedDB
      await loadPersistedQueues();
      
      // Clean up old caches
      const cacheNames = await caches.keys();
      const validCaches = [STATIC_CACHE, IMAGE_CACHE, API_CACHE, STREAM_CACHE];
      
      await Promise.all(
        cacheNames.map(async (name) => {
          if (name.startsWith(CACHE_PREFIX) && !validCaches.includes(name)) {
            console.log(`[SW] Deleting old cache: ${name}`);
            await caches.delete(name);
          }
        })
      );
      
      // Notify all clients about the update
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: APP_VERSION,
          buildTime: CACHE_VERSION
        });
      });
      
      // Enable navigation preload if supported
      try {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      } catch (e) {
        console.log('[SW] Navigation preload not supported');
      }
    })()
  );
});

// ===== FETCH EVENT WITH ADVANCED CACHING STRATEGIES =====
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    // Handle POST requests with background sync
    if (shouldQueueForSync(request)) {
      event.respondWith(handleBackgroundSync(request));
    }
    return;
  }
  
  // Skip streaming content - Network Only
  if (
    url.pathname.startsWith('/streams/') ||
    url.pathname.includes('.m3u8') ||
    url.pathname.includes('.ts') ||
    url.pathname.endsWith('.mp4') ||
    url.hostname.includes('livekit.cloud') ||
    url.hostname.includes('livestream')
  ) {
    return;
  }
  
  // Skip Supabase realtime subscriptions
  if (url.pathname.includes('/realtime/v1/')) {
    return;
  }
  
  // Route based on request destination and URL pattern
  if (request.mode === 'navigate') {
    // Navigation: Network First with offline fallback
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'worker'
  ) {
    // Static assets: Cache First
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (request.destination === 'image') {
    // Images: Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
  } else if (
    url.hostname.includes('supabase') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/rest/v1/')
  ) {
    // API calls: Network First with longer cache for stability
    // Skip auth requests
    if (url.pathname.includes('/auth/v1/')) {
      return;
    }
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 30000));
  }
});

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  const queueName = event.tag;
  if (SYNC_QUEUES[queueName]) {
    event.waitUntil(processSyncQueue(queueName));
  }
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let notificationData: Record<string, any> = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = { body: event.data.text() };
    }
  }
  
  const title = notificationData.title || 'Troll City';
  
  // Build notification options with extended typing for PWA features
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notificationOptions: any = {
    body: notificationData.body || 'New update from Troll City!',
    icon: notificationData.icon || '/icons/icon-192.png',
    badge: notificationData.badge || '/icons/icon-72.png',
    image: notificationData.image,
    tag: notificationData.tag || 'troll-city-notification',
    requireInteraction: notificationData.requireInteraction || false,
    silent: notificationData.silent || false,
    vibrate: notificationData.vibrate || [200, 100, 200],
    data: {
      url: notificationData.url || '/',
      action: notificationData.action,
      type: notificationData.type,
      ...notificationData.data
    }
  };
  
  // Add action buttons based on notification type
  switch (notificationData.type) {
    case 'BATTLE_INVITATION':
      notificationOptions.actions = [
        { action: 'accept', title: 'Join Battle' },
        { action: 'decline', title: 'Decline' }
      ];
      break;
    case 'NEW_LIVESTREAM':
      notificationOptions.actions = [
        { action: 'watch', title: 'Watch Now' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
      break;
    case 'GIFT_RECEIVED':
      notificationOptions.actions = [
        { action: 'view', title: 'View Gift' },
        { action: 'thanks', title: 'Say Thanks' }
      ];
      break;
    case 'PRIVATE_MESSAGE':
      notificationOptions.actions = [
        { action: 'reply', title: 'Reply' },
        { action: 'read', title: 'Mark Read' }
      ];
      break;
    case 'FRIEND_REQUEST':
      notificationOptions.actions = [
        { action: 'accept', title: 'Accept' },
        { action: 'decline', title: 'Decline' }
      ];
      break;
    case 'MODERATION_ALERT':
      notificationOptions.requireInteraction = true;
      notificationOptions.actions = [
        { action: 'review', title: 'Review' },
        { action: 'acknowledge', title: 'Acknowledge' }
      ];
      break;
    case 'STREAM_GOING_LIVE':
      notificationOptions.actions = [
        { action: 'watch', title: 'Watch Now' },
        { action: 'remind', title: 'Remind Later' }
      ];
      break;
  }
  
  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
  
  // Notify open clients
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          payload: notificationData
        });
      });
    })()
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notificationData = (event.notification as any).data || {};
  const action = event.action;
  const url = notificationData.url || '/';
  
  console.log('[SW] Notification clicked:', { action, url, type: notificationData.type });
  
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      
      // Handle action buttons
      if (action) {
        // Notify clients about the action
        clients.forEach((client) => {
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action,
            notificationData
          });
        });
        
        // Navigate for certain actions
        const navigateActions = ['watch', 'view', 'reply', 'accept', 'join', 'review'];
        if (navigateActions.includes(action)) {
          if (clients.length > 0) {
            const client = clients[0];
            await client.focus();
            client.postMessage({ type: 'NAVIGATE', url });
          } else {
            await self.clients.openWindow(url);
          }
        }
        return;
      }
      
      // Default: focus existing or open new
      if (clients.length > 0) {
        const client = clients[0];
        await client.focus();
        client.postMessage({ type: 'NAVIGATE', url });
      } else {
        await self.clients.openWindow(url);
      }
    })()
  );
});

// ===== MESSAGE HANDLER =====
self.addEventListener('message', (event) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      console.log('[SW] Skip waiting requested');
      self.skipWaiting();
      break;
      
    case 'CACHE_STREAM_DATA':
      if (payload?.streamId) {
        cacheStreamData(payload.streamId, payload.data);
      }
      break;
      
    case 'CACHE_USER_PROFILE':
      if (payload?.userId) {
        cacheUserProfile(payload.userId, payload.data);
      }
      break;
      
    case 'CACHE_CHAT_MESSAGES':
      if (payload?.roomId) {
        cacheChatMessages(payload.roomId, payload.messages);
      }
      break;
      
    case 'CLEAR_CACHES':
      clearAllCaches();
      break;
      
    case 'GET_SW_VERSION':
      if (event.source) {
        event.source.postMessage({
          type: 'SW_VERSION',
          version: APP_VERSION,
          buildTime: CACHE_VERSION
        });
      }
      break;
      
    case 'PREFETCH_STREAM':
      if (payload?.streamId) {
        prefetchStreamData(payload.streamId);
      }
      break;
      
    case 'SYNC_WHEN_ONLINE':
      if (payload?.queueName && payload?.data) {
        queueForSync(payload.queueName, payload.data);
      }
      break;
  }
});

// ===== CACHING STRATEGY FUNCTIONS =====

// Cache First: Best for static assets
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const network = await fetch(request);
    if (network.ok) {
      cache.put(request, network.clone());
    }
    return network;
  } catch (err) {
    return new Response('Network error', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network First with offline fallback
async function networkFirstWithOfflineFallback(request: Request): Promise<Response> {
  try {
    // Try preload first
    const preloadResponse = await (request as Request & { preloadResponse?: Promise<Response> }).preloadResponse;
    if (preloadResponse) {
      return preloadResponse;
    }
  } catch (e) {
    // Preload not supported
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch (err) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    // Return offline page for navigation
    const offline = await cache.match(OFFLINE_URL);
    if (offline) {
      return offline;
    }
    
    return new Response('You are offline', { 
      status: 503, 
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Network First with timeout
async function networkFirstWithTimeout(
  request: Request, 
  cacheName: string, 
  timeout: number
): Promise<Response> {
  const cache = await caches.open(cacheName);
  
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), timeout);
  });
  
  try {
    return await Promise.race([networkPromise, timeoutPromise]);
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw err;
  }
}

// Stale While Revalidate: Best for images
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Always fetch from network in background
  const fetchPromise = fetch(request).then((network) => {
    if (network.ok) {
      cache.put(request, network.clone());
    }
    return network;
  }).catch(() => {
    // Network failed, ignore for now
    return undefined;
  });
  
  // Return cached version immediately if available
  if (cached) {
    // Revalidate in background
    void fetchPromise;
    return cached;
  }
  
  // No cache, wait for network
  const result = await fetchPromise;
  if (result) {
    return result;
  }
  return new Response('Image not available', { status: 503 });
}

// ===== BACKGROUND SYNC FUNCTIONS =====

function shouldQueueForSync(request: Request): boolean {
  const url = new URL(request.url);
  const syncPaths = ['/chat', '/reactions', '/gifts', '/follow'];
  return syncPaths.some((path) => url.pathname.includes(path));
}

async function handleBackgroundSync(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    return response;
  } catch (err) {
    // Queue for later
    const url = new URL(request.url);
    let queueName = 'chat-messages';
    
    if (url.pathname.includes('/reactions')) queueName = 'reactions';
    else if (url.pathname.includes('/gifts')) queueName = 'gifts';
    else if (url.pathname.includes('/follow')) queueName = 'follows';
    
    // Clone and store request
    const requestClone = request.clone();
    const body = await requestClone.text();
    
    const queueData: QueuedRequest = {
      url: request.url,
      method: request.method,
      headers: Array.from(request.headers.entries()),
      body,
      timestamp: Date.now()
    };
    
    queueForSync(queueName, queueData);
    
    // Register for sync when online
    if ('sync' in self.registration) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (self.registration as any).sync.register(queueName);
    }
    
    // Return a queued response
    return new Response(
      JSON.stringify({ queued: true, message: 'Will sync when online' }),
      { 
        status: 202, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function queueForSync(queueName: string, data: any) {
  if (!SYNC_QUEUES[queueName]) {
    SYNC_QUEUES[queueName] = [];
  }
  SYNC_QUEUES[queueName].push(data);
  
  // Persist to IndexedDB for durability
  persistQueue(queueName);
}

async function persistQueue(queueName: string) {
  try {
    const db = await openQueueDB();
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    store.put({ queueName, items: SYNC_QUEUES[queueName], updatedAt: Date.now() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    console.log(`[SW] Persisted queue: ${queueName}, items: ${SYNC_QUEUES[queueName].length}`);
  } catch (err) {
    console.warn(`[SW] Failed to persist queue ${queueName}:`, err);
  }
}

async function processSyncQueue(queueName: string) {
  const queue = SYNC_QUEUES[queueName];
  if (!queue || queue.length === 0) return;
  
  console.log(`[SW] Processing ${queue.length} items in queue: ${queueName}`);
  
  const failed: QueuedRequest[] = [];
  
  for (const item of queue) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: new Headers(item.headers),
        body: item.body
      });
    } catch (err) {
      failed.push(item);
    }
  }
  
  // Keep failed items for next sync
  SYNC_QUEUES[queueName] = failed;
  
  // Persist updated queue state
  if (failed.length === 0) {
    await clearPersistedQueue(queueName);
  } else {
    await persistQueue(queueName);
  }
  
  // Notify clients about sync completion
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      queueName,
      processed: queue.length - failed.length,
      failed: failed.length
    });
  });
}

// ===== CACHE HELPERS =====

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cacheStreamData(streamId: string, data: unknown) {
  try {
    const cache = await caches.open(STREAM_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300' // 5 minutes
      }
    });
    await cache.put(`/stream-data/${streamId}`, response);
  } catch (err) {
    console.error('[SW] Failed to cache stream data:', err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cacheUserProfile(userId: string, data: unknown) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(`/profile-data/${userId}`, response);
  } catch (err) {
    console.error('[SW] Failed to cache user profile:', err);
  }
}

async function cacheChatMessages(roomId: string, messages: unknown[]) {
  try {
    const cache = await caches.open(API_CACHE);
    const response = new Response(JSON.stringify({ roomId, messages, cachedAt: Date.now() }), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(`/chat-messages/${roomId}`, response);
  } catch (err) {
    console.error('[SW] Failed to cache chat messages:', err);
  }
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('[SW] All caches cleared');
}

async function prefetchStreamData(streamId: string) {
  console.log(`[SW] Prefetching stream data: ${streamId}`);
  // Implementation would fetch and cache stream metadata
}

// ===== PERIODIC SYNC =====
self.addEventListener('periodicsync', (event: Event) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tag = (event as any).tag;
  
  if (tag === 'preload-streams') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event as any).waitUntil(preloadUpcomingStreams());
  } else if (tag === 'refresh-cache') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event as any).waitUntil(refreshCache());
  }
});

async function preloadUpcomingStreams() {
  console.log('[SW] Preloading upcoming streams...');
  // Implementation would fetch upcoming streams and cache metadata
}

async function refreshCache() {
  console.log('[SW] Refreshing cache...');
  // Refresh critical assets
}

// Log successful registration
console.log('[SW] Troll City Service Worker loaded successfully v' + APP_VERSION);

// Export empty object to make this a module
export {};
