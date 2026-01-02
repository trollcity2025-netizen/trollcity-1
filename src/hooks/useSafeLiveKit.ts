import { useContext } from 'react'
import { LiveKitContext } from '../contexts/LiveKitContext'

/**
 * Safe version of useLiveKit that doesn't throw errors
 * Returns null if context is not available instead of throwing
 */
export function useSafeLiveKit() {
  const ctx = useContext(LiveKitContext)
  return ctx // Returns null if not available, no error thrown
}

/**
 * Hook to check if LiveKit context is available
 */
export function useLiveKitAvailable() {
  const ctx = useContext(LiveKitContext)
  return ctx !== null
}

/**
 * Hook to get LiveKit context with fallback values
 */
export function useLiveKitWithFallback(fallback = {}) {
  const ctx = useContext(LiveKitContext)
  return ctx || fallback
}