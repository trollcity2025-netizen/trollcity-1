import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { LiveKitProvider } from './contexts/LiveKitProvider'
import { AuthProvider } from './contexts/AuthProvider'
import { GlobalAppProvider } from './contexts/GlobalAppContext'
// GlobalAppProvider intentionally removed per required root layout
import { supabase } from './lib/supabase'

// App version for cache busting
const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ||
  (import.meta.env.VITE_PUBLIC_APP_VERSION as string | undefined) ||
  '1.0.0'

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

// Debug helper to access environment variables in browser console
// Usage: window.__ENV.VITE_LIVEKIT_URL
if (typeof window !== 'undefined') {
  (window as any).__ENV = import.meta.env
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element (#root) not found')
}

if (typeof window !== 'undefined') {
  // PWA Service Worker Registration
  // We use vite-plugin-pwa's virtual module to handle registration and updates
  // @ts-expect-error - Virtual module
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('[SW] update ready, forcing reload')
        updateSW(true)
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
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          return
        }

        const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
        if (!publicKey) {
          console.warn('Missing VITE_VAPID_PUBLIC_KEY; push subscription skipped')
          return
        }

        const registration = await navigator.serviceWorker.ready
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

createRoot(rootElement).render(
  <BrowserRouter>
    <LiveKitProvider>
      <AuthProvider>
        <GlobalAppProvider>
          <App />
        </GlobalAppProvider>
      </AuthProvider>
    </LiveKitProvider>
  </BrowserRouter>
)
