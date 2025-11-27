import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)

// Service Worker registration - with proper cleanup on updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Check for updates every hour
        setInterval(() => {
          registration.update()
        }, 3600000)
      })
      .catch(() => {
        console.warn('Service worker registration failed')
      })
      
    // Clear old service workers and caches on app startup
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        if (registration.active && registration.active.scriptURL.includes('sw.js')) {
          // Keep current, but ensure it's updated
          registration.update()
        }
      })
    })
  })
}
