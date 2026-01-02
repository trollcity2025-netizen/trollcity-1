import React from 'react'
import { useLiveKitAvailable } from '../hooks/useSafeLiveKit'
import { useGlobalApp } from '../contexts/GlobalAppContext'

interface LiveKitGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  requireConnection?: boolean
}

/**
 * Component that guards access to LiveKit-dependent features
 * Only renders children when LiveKit context is available
 */
export function LiveKitGuard({ 
  children, 
  fallback = null,
  requireConnection = false 
}: LiveKitGuardProps) {
  const isAvailable = useLiveKitAvailable()
  const { setError } = useGlobalApp()
  
  React.useEffect(() => {
    if (!isAvailable) {
      console.warn('[LiveKitGuard] LiveKit context not available')
      setError('LiveKit connection not available. Please refresh the page.')
    }
  }, [isAvailable, setError])
  
  if (!isAvailable) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

/**
 * Higher-order component version of LiveKitGuard
 */
export function withLiveKitGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardProps: Omit<LiveKitGuardProps, 'children'> = {}
) {
  const WrappedComponent = (props: P) => (
    <LiveKitGuard {...guardProps}>
      <Component {...props} />
    </LiveKitGuard>
  )
  
  WrappedComponent.displayName = `withLiveKitGuard(${Component.displayName || Component.name})`
  
  return WrappedComponent
}