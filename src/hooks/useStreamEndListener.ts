import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

interface UseStreamEndListenerProps {
  streamId: string
  enabled?: boolean
  redirectToSummary?: boolean
}

/**
 * Hook that listens for stream end events and automatically redirects users
 * Works with both BroadcastPage and OfficerStreamGrid components
 */
export function useStreamEndListener({
  streamId,
  enabled = true,
  redirectToSummary = true,
}: UseStreamEndListenerProps) {
  const navigate = useNavigate()
  const effectRan = useRef(false)

  useEffect(() => {
    if (!enabled || !streamId || effectRan.current) return
    effectRan.current = true

    console.log('[useStreamEndListener] Setting up listener for stream:', streamId)

    // Main listener for stream table updates
    const streamChannel = supabase
      .channel(`stream-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const newRecord = payload.new as any
          console.log('[useStreamEndListener] Stream update detected:', newRecord)
          
          if (newRecord?.status === 'ended') {
            console.log('[useStreamEndListener] Stream ended detected, redirecting to summary...')
            if (redirectToSummary) {
              navigate(`/broadcast/summary/${streamId}`)
            }
          }
        }
      )
      .subscribe()

    // Secondary listener for stream_ended_logs table (fallback method)
    const logChannel = supabase
      .channel(`stream-ended-log-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_ended_logs',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[useStreamEndListener] Stream ended log detected:', payload)
          if (redirectToSummary) {
            navigate(`/broadcast/summary/${streamId}`)
          }
        }
      )
      .subscribe()

    return () => {
      console.log('[useStreamEndListener] Cleaning up listeners for stream:', streamId)
      streamChannel.unsubscribe()
      logChannel.unsubscribe()
    }
  }, [streamId, enabled, redirectToSummary, navigate])
}

/**
 * Hook for components that need to manually trigger stream end redirect
 */
export function useForceStreamEndRedirect(streamId: string) {
  const navigate = useNavigate()

  const redirectToSummary = (reason?: string) => {
    console.log('[useForceStreamEndRedirect] Forcing redirect to stream summary:', streamId, reason)
    navigate(`/stream-summary/${streamId}`)
  }

  return { redirectToSummary }
}