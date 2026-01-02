import { useContext } from 'react'
import { LiveKitContext } from '../contexts/LiveKitContext'

export function useLiveKit() {
  const ctx = useContext(LiveKitContext)
  if (!ctx) {
    // Enhanced error message with troubleshooting guidance
    const errorMessage = 'LiveKit context not available. Make sure you are inside a LiveKitProvider and the room is properly initialized.'
    console.error('[useLiveKit] Context error:', errorMessage)
    throw new Error(errorMessage)
  }
  return ctx
}