import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { LiveKitProvider } from './contexts/LiveKitContext'
import { AuthProvider } from './contexts/AuthProvider'
import { GlobalAppProvider } from './contexts/GlobalAppContext'
// GlobalAppProvider intentionally removed per required root layout

// App version for cache busting
const APP_VERSION = '1.0.0-' + Date.now().toString()

// App version guard - clear storage on deploy
const storedVersion = localStorage.getItem('app_version')
if (storedVersion !== APP_VERSION) {
  console.log('App version changed, clearing storage')
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('app_version', APP_VERSION)
}

// Unregister all service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('Unregistering service worker:', registration.scope)
      registration.unregister()
    })
  })
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element (#root) not found')
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
