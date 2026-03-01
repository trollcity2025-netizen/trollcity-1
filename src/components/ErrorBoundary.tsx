import { Component, ErrorInfo, ReactNode } from 'react'
import { toast } from 'sonner'
import { reportError } from '../lib/supabase'
import { trackEvent } from '../lib/telemetry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
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
    
    // Store error info in state for display
    this.setState({ errorInfo: info })
    
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
    // Enhanced error detection and handling
    const errorMessage = error.message || ''
    

    
    // Handle other specific error types
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
      toast.error('Network connection issue. Please check your internet connection.')
      return
    }

    // Auto-reload on chunk load errors (once)
    if (errorMessage.includes('dynamically imported module') || errorMessage.includes('Importing a module script failed')) {
      const env = (import.meta as any).env
      if (typeof window !== 'undefined' && env?.PROD) {
        const storageKey = 'tc_chunk_reload_once'
        const hasReloaded = sessionStorage.getItem(storageKey)
        if (!hasReloaded) {
          sessionStorage.setItem(storageKey, 'true')
          console.log('Chunk load error detected, reloading...')
          window.location.reload()
          return
        }
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

    const { error, errorInfo } = this.state
    const errorMessage = error?.message || 'Unknown error'
    const errorStack = error?.stack || ''
    const componentStack = errorInfo?.componentStack || ''
    
    // Determine error type for better messaging
    let errorType = 'Error'
    if (errorMessage.includes('dynamically imported module') || errorMessage.includes('Importing a module script failed') || errorMessage.includes('module')) {
      errorType = 'Module Load Error'
    } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
      errorType = 'Network Error'
    } else if (errorMessage.includes('Cannot read') || errorMessage.includes('undefined') || errorMessage.includes('null')) {
      errorType = 'Runtime Error'
    }

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 md:p-8">
        <div className="max-w-4xl w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Error Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-white mb-1">{errorType}</h1>
              <p className="text-red-400 font-mono text-sm break-all">{errorMessage}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-semibold transition-all"
            >
              🔄 Refresh Page
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all"
            >
              Reload App
            </button>
          </div>

          {/* Error Details - Collapsible */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white transition-colors py-2 select-none">
              <svg className="w-4 h-4 transform group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium">View Error Details</span>
            </summary>
            
            <div className="mt-4 space-y-4">
              {/* Error Stack */}
              {errorStack && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Error Stack</h3>
                  <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto text-xs text-red-300 font-mono whitespace-pre-wrap break-all">
                    {errorStack}
                  </pre>
                </div>
              )}

              {/* Component Stack */}
              {componentStack && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Component Stack</h3>
                  <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto text-xs text-blue-300 font-mono whitespace-pre-wrap break-all">
                    {componentStack}
                  </pre>
                </div>
              )}

              {/* Error Object */}
              {error && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Error Object</h3>
                  <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto text-xs text-green-300 font-mono whitespace-pre-wrap break-all">
                    {JSON.stringify({
                      name: error.name,
                      message: error.message,
                      cause: error.cause,
                    }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-slate-500 text-sm">
              If this error persists after refreshing, please contact support with the error details above.
            </p>
          </div>
        </div>
      </div>
    )
  }
}
