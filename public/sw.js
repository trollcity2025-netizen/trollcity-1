const VERSION = 'trollcity-sw-v2'
const STATIC_CACHE = `${VERSION}-static`
const CACHE_ALLOWLIST = [STATIC_CACHE]

// Minimal static list; runtime will cache static assets on demand
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
]

// Install: pre-cache core shell and take over immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !CACHE_ALLOWLIST.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: network-first for navigation; cache-first for static; network-only for APIs
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip non-http(s)
  if (!url.protocol.startsWith('http')) return

  // Network-only for Supabase/LiveKit/API calls
  const isApi = url.hostname.includes('supabase') || url.hostname.includes('livekit') || url.pathname.startsWith('/api')
  if (isApi) return

  // Navigation requests: network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static asset heuristic
  const isStatic = /\.(js|css|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$/i.test(url.pathname)

  if (isStatic || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          const copy = res.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          return res
        })
      })
    )
  }
})
