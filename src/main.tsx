import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import './styles/broadcast-responsive.css'
import { LiveKitProvider } from './contexts/LiveKitProvider'
import { AuthProvider } from './contexts/AuthProvider'
import { GlobalAppProvider } from './contexts/GlobalAppContext'
import { supabase } from './lib/supabase'
import { initTelemetry } from './lib/telemetry'
import { initMobilePlatform, isMobilePlatform } from './lib/mobilePlatform'

// App version for cache busting
const env = import.meta.env
const APP_VERSION =
  (env.VITE_APP_VERSION as string | undefined) ||
  (env.VITE_PUBLIC_APP_VERSION as string | undefined) ||
  '1.0.0'

// Initialize mobile platform features (Capacitor)
if (isMobilePlatform) {
  console.log('[Main] Running on native mobile platform');
  initMobilePlatform().catch((error) => {
    console.error('[Main] Failed to initialize mobile platform:', error);
  });
}

// App version guard - clear storage on deploy
try {
  const storedVersion = localStorage.getItem('app_version')
  if (storedVersion !== APP_VERSION) {
    console.log('App version changed, clearing storage')
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('app_version', APP_VERSION)
  }
} catch (error) {
  console.warn('Unable to evaluate app version guard', error)
}

if (typeof window !== 'undefined') {
  (window as any).__ENV = env
  initTelemetry()
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element (#root) not found')
}

if (typeof window !== 'undefined' && !env.PROD) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        r.unregister().then((ok) => console.log('[SW] unregistered:', ok, r.scope)).catch(() => {});
      });
    }).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((k) => {
        if (k.toLowerCase().includes('workbox') || k.toLowerCase().includes('vite') || k.toLowerCase().includes('pwa')) {
          caches.delete(k).then((deleted) => console.log('[SW] deleted cache:', k, deleted)).catch(() => {});
        }
      });
    }).catch(() => {});
  }
}

if (typeof window !== 'undefined' && env.PROD) {
  // PWA Service Worker Registration (only in production)
  // We use vite-plugin-pwa's virtual module to handle registration and updates
  // Skip SW registration during development to avoid Workbox CDN import issues
  // @ts-expect-error - Virtual module
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('[SW] update ready, dispatching in-app update event')
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pwa-update-available'))
        }
      },
      onOfflineReady() {
        console.log('App ready to work offline')
      },
    })

    const checkForUpdate = () => {
      if (typeof updateSW === 'function') {
        void updateSW()
      }
    }

    const runPeriodicUpdateCheck = () => {
      if (typeof window === 'undefined') return

      checkForUpdate()
      const interval = window.setInterval(checkForUpdate, 1000 * 60 * 30)
      window.addEventListener('beforeunload', () => {
        window.clearInterval(interval)
      })
    }

    runPeriodicUpdateCheck()

    const urlBase64ToUint8Array = (base64String: string) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = window.atob(base64)
      const outputArray = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
      }
      return outputArray
    }

    const initPushNotifications = async () => {
      try {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
          return
        }

        // Check if we already asked or if permission is already granted/denied
        if (Notification.permission === 'default') {
          const hasAsked = localStorage.getItem('push_notification_requested')
          if (hasAsked) {
            return
          }
          localStorage.setItem('push_notification_requested', 'true')
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') {
            return
          }
        } else if (Notification.permission !== 'granted') {
          return
        }

        const publicKey = env.VITE_VAPID_PUBLIC_KEY as string | undefined
        if (!publicKey) {
          console.warn('Missing VITE_VAPID_PUBLIC_KEY; push subscription skipped')
          return
        }

        let registration: ServiceWorkerRegistration | undefined
        try {
          registration = await navigator.serviceWorker.ready
        } catch (swErr) {
          console.warn('No active service worker (push skip)', swErr)
          return
        }
        const existing = await registration.pushManager.getSubscription()
        const subscription =
          existing ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          }))

        const { data: sessionData } = await supabase.auth.getSession()
        const userId = sessionData?.session?.user?.id
        if (!userId) {
          return
        }

        const subJson = subscription.toJSON() as any
        const expiration =
          (subscription as any).expirationTime
            ? new Date((subscription as any).expirationTime).toISOString()
            : null

        await supabase
          .from('web_push_subscriptions')
          .upsert(
            {
              user_id: userId,
              endpoint: subJson.endpoint,
              keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
              expiration_time: expiration,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'endpoint' }
          )
      } catch (err) {
        console.warn('Push notification setup failed', err)
      }
    }

    initPushNotifications()
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void initPushNotifications()
      }
    })
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LiveKitProvider>
        <AuthProvider>
          <GlobalAppProvider>
            <App />
          </GlobalAppProvider>
        </AuthProvider>
      </LiveKitProvider>
    </BrowserRouter>
  </QueryClientProvider>
)
