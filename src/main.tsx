import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import App from './App'
import './index.css'

// Debug: Check if root element exists
console.log('🔍 main.tsx executing...')
const rootElement = document.getElementById('root')
console.log('🔍 Root element:', rootElement ? 'Found ✅' : 'NOT FOUND ❌')

if (!rootElement) {
  console.error('❌ Root element not found!')
  document.body.innerHTML = '<div style="padding: 20px; color: red; font-family: monospace; background: white;">Error: Root element (#root) not found in HTML</div>'
} else {
  console.log('✅ Root element found, rendering app...')
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <Router>
          <App />
        </Router>
      </StrictMode>,
    )
    console.log('✅ React app rendered successfully!')
  } catch (error) {
    console.error('❌ Error rendering React app:', error)
    rootElement.innerHTML = `<div style="padding: 20px; color: red; font-family: monospace; background: white;">Error rendering app: ${error instanceof Error ? error.message : String(error)}</div>`
  }
}

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        setInterval(() => {
          registration.update()
        }, 3600000)
      })
      .catch(() => {
        console.warn('Service worker registration failed')
      })
  })
}
