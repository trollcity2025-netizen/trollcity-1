import { Component, ErrorInfo, ReactNode } from 'react'
import { toast } from 'sonner'

interface Props {
  children: ReactNode
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
    
    // Enhanced error detection and handling
    const errorMessage = error.message || ''
    
    // Handle LiveKit context errors
    if (errorMessage.includes('useLiveKit must be used within LiveKitProvider') || 
        errorMessage.includes('no room provided') ||
        errorMessage.includes('room context')) {
      console.error('LiveKit context error detected:', errorMessage)
      toast.error('Stream connection error. Please refresh to reconnect.')
      return
    }
    
    // Handle other specific error types
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
      toast.error('Network connection issue. Please check your internet connection.')
      return
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
