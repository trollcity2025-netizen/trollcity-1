import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { LiveKitProvider } from './contexts/LiveKitProvider'
import { AuthProvider } from './contexts/AuthProvider'
import { GlobalAppProvider } from './contexts/GlobalAppContext'
// GlobalAppProvider intentionally removed per required root layout

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
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        if (confirm('New content available. Reload?')) {
          updateSW(true)
        }
      },
      onOfflineReady() {
        console.log('App ready to work offline')
      },
    })
  })
}

createRoot(rootElement).render(
  <LiveKitProvider>
      <AuthProvider>
        <GlobalAppProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </GlobalAppProvider>
      </AuthProvider>
    </LiveKitProvider>
)
