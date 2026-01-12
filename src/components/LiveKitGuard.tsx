import React from 'react'
import { useLiveKitAvailable } from '../hooks/useSafeLiveKit'
import { useGlobalApp } from '../contexts/GlobalAppContext'

interface LiveKitGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  requireConnection?: boolean
}

const LIVEKIT_GUARD_ERROR = 'LiveKit connection not available. Please refresh the page.'

/**
 * Component that guards access to LiveKit-dependent features
 * Only renders children when LiveKit context is available
 */
export function LiveKitGuard({ 
  children, 
  fallback = null,
  requireConnection: _requireConnection = false 
}: LiveKitGuardProps) {
  const isAvailable = useLiveKitAvailable()
  const { setError, clearError, error } = useGlobalApp()
  
  React.useEffect(() => {
    if (!isAvailable) {
      console.warn('[LiveKitGuard] LiveKit context not available')
      if (error !== LIVEKIT_GUARD_ERROR) {
        setError(LIVEKIT_GUARD_ERROR)
      }
      return
    }

    if (error === LIVEKIT_GUARD_ERROR) {
      clearError()
    }
  }, [isAvailable, error, setError, clearError])
  
  if (!isAvailable) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

/**
 * Higher-order component version of LiveKitGuard
 */
// eslint-disable-next-line react-refresh/only-export-components
export function withLiveKitGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardProps: Omit<LiveKitGuardProps, 'children'> = {}
): React.FC<P> {
  const WrappedComponent = (props: P) => (
    <LiveKitGuard {...guardProps}>
      <Component {...props} />
    </LiveKitGuard>
  )
  
  WrappedComponent.displayName = `withLiveKitGuard(${Component.displayName || Component.name})`
  
  return WrappedComponent
}
