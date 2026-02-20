import { Component, ErrorInfo, ReactNode } from 'react'
import { toast } from 'sonner'
import { reportError } from '../lib/supabase'
import { trackEvent } from '../lib/telemetry'
import { logMobileError } from '../lib/MobileErrorLogger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
    
    trackEvent({
      event_type: 'react_render_error',
      message: error?.message || 'ErrorBoundary caught error',
      stack: error?.stack,
      severity: 'error',
      fingerprint: `render-${error?.message?.slice(0, 50)}`,
      extra: { info }
    });

    void reportError({
      message: error?.message || 'ErrorBoundary caught error',
      stack: error?.stack,
      component: 'ErrorBoundary',
      context: { info }
    })
    
    // Log to mobile error logs if applicable
    logMobileError(error, { component: 'ErrorBoundary', info })
    
    // Enhanced error detection and handling
    const errorMessage = error.message || ''
    
    
    // Handle other specific error types
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
      toast.error('Network connection issue. Please check your internet connection.')
      return
    }

    // Auto-reload on chunk load errors (once)
    if (errorMessage.includes('dynamically imported module') || errorMessage.includes('Importing a module script failed')) {
      const storageKey = 'tc_chunk_reload_' + window.location.pathname;
      const hasReloaded = sessionStorage.getItem(storageKey);
      
      if (!hasReloaded) {
        sessionStorage.setItem(storageKey, 'true');
        console.log('Chunk load error detected, reloading...');
        window.location.reload();
        return;
      }
    }
    
    // Default error handling
    toast.error('A module failed to load. Please refresh to update.')
  }

  handleReload = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-2xl font-bold mb-2 text-white">Module failed to load</h1>
        <p className="text-sm text-gray-300 mb-4">
          A recent update changed the app bundle. Refreshing will load the latest version.
        </p>
        <button
          onClick={this.handleReload}
          className="px-5 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold"
        >
          Refresh now
        </button>
      </div>
    )
  }
}
