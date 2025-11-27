const CACHE_NAME = 'tc-app-v2'

// URLs that should NEVER be cached
const SKIP_CACHE_URLS = [
  '/rest/v1/',
  '/auth/v1/',
  '/realtime/v1/',
  'supabase.co',
  '/api/',
  '/functions/v1/',
  'localhost:3001'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = req.url
  
  // Don't cache:
  // - Non-GET requests
  // - API calls (Supabase, backend API)
  // - External resources that need fresh data
  if (req.method !== 'GET' || SKIP_CACHE_URLS.some(skip => url.includes(skip))) {
    return
  }
  
  // Only cache static assets (JS, CSS, images, fonts)
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/i.test(url)
  
  if (!isStaticAsset) {
    // For HTML and other dynamic content, always fetch from network
    return
  }
  
  event.respondWith(
    fetch(req)
      .then((resp) => {
        // Only cache successful responses for static assets
        if (resp.ok && isStaticAsset) {
          const copy = resp.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, copy).catch(() => {})
          })
        }
        return resp
      })
      .catch(() => {
        // Only use cache as fallback for static assets
        return caches.match(req).then(cached => {
          return cached || new Response('Offline', { status: 503 })
        })
      })
  )
})
