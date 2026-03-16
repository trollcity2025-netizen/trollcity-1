import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { PreflightStore } from '../lib/preflightStore'
import { useStreamStore } from '../lib/streamStore'

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
  const { clearTracks } = useStreamStore()

  useEffect(() => {
    if (!enabled || !streamId) return

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
          
          // CRITICAL: Only trigger on actual stream END, not on status changes to 'live'
          // Also check that this is NOT a fresh stream start (is_live changing from false->true is OK)
          const isActuallyEnded = newRecord?.status === 'ended' || newRecord?.is_live === false;
          const wasAlreadyEnded = newRecord?.status === 'ended';
          
          // Additional check: if status changed TO 'ended', that's a real end
          // But if is_live changed to false WITHOUT status='ended', that might be a false positive
          if (!isActuallyEnded) {
            console.log('[useStreamEndListener] Ignoring non-end status update:', newRecord?.status, newRecord?.is_live);
            return;
          }
          
          // Double-check: if only is_live=false but status='live', don't treat as ended
          // This can happen during stream initialization
          if (newRecord?.is_live === false && newRecord?.status !== 'ended') {
            console.log('[useStreamEndListener] Ignoring is_live=false with status!=ended (possible initialization):', newRecord);
            return;
          }
          
          console.log('[useStreamEndListener] Stream ended detected, stopping camera and redirecting to summary...')
          // Stop camera and mic tracks when stream ends
          PreflightStore.clear()
          clearTracks()
          if (redirectToSummary) {
            navigate(`/broadcast/summary/${streamId}`)
          }
        }
      )
      .on(
        'broadcast',
        { event: 'stream-ended' },
        (payload) => {
          console.log('[useStreamEndListener] Received broadcast stream-ended event:', payload)
          const { streamId: endedStreamId } = payload.payload || {}
          
          if (endedStreamId === streamId) {
            console.log('[useStreamEndListener] Stream ended via broadcast, stopping camera and redirecting...')
            // Stop camera and mic tracks when stream ends
            PreflightStore.clear()
            clearTracks()
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
          // Stop camera and mic tracks when stream ends
          PreflightStore.clear()
          clearTracks()
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
  }, [streamId, enabled, redirectToSummary, navigate, clearTracks])
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