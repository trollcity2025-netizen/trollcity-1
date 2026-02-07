import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { getUserEntranceEffect } from '../lib/entranceEffects'

/**
 * Tracks viewer presence using Supabase Realtime.
 * - Viewers join the 'room:{streamId}' channel.
 * - The Host (broadcaster) is responsible for periodically updating the 'streams' table
 *   with the accurate viewer count to avoid DB write storms.
 */
export function useViewerTracking(streamId: string | null, isHost: boolean = false) {
  const { user, profile } = useAuthStore()
  const [viewerCount, setViewerCount] = useState<number>(0)
  const lastDbUpdate = useRef<number>(0)

  useEffect(() => {
    if (!streamId || !user) return

    const channel = supabase.channel(`room:${streamId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        // Count unique user_ids
        const count = Object.keys(state).length
        setViewerCount(count)

        // If Host OR Officer/Admin, update DB (throttled)
        // This ensures the DB is updated even if the host is not in the browser
        const isOfficer = 
            profile?.role === 'admin' || 
            profile?.role === 'troll_officer' || 
            profile?.is_troll_officer ||
            profile?.is_admin ||
            profile?.troll_role === 'admin' ||
            profile?.troll_role === 'troll_officer';

        if (isHost || isOfficer) {
          const now = Date.now()
          if (now - lastDbUpdate.current > 15000) { // Update every 15s
            lastDbUpdate.current = now
            
            // Use RPC to bypass potential RLS issues for officers
            supabase
              .rpc('update_stream_viewer_count', { 
                  p_stream_id: streamId, 
                  p_count: count 
              })
              .then(({ error }) => {
                if (error) {
                    console.error('Failed to update stream viewer count:', error)
                }
              })
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Fetch entrance effect before tracking
          let entranceEffect = null;
          try {
             const effectData = await getUserEntranceEffect(user.id);
             if (effectData?.config) {
                 entranceEffect = effectData.config;
             }
          } catch (e) {
             console.error('Failed to load entrance effect:', e);
          }

          await channel.track({
            user_id: user.id,
            username: profile?.username || 'User',
            avatar_url: profile?.avatar_url,
            role: profile?.role,
            troll_role: profile?.troll_role,
            joined_at: new Date().toISOString(),
            entrance_effect: entranceEffect
          })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [streamId, user, isHost, profile])

  return { viewerCount }
}

/**
 * Hook to get live viewer count for a stream from the Database.
 * Used for listing pages (Home, Sidebar) where we don't need real-time presence.
 */
export function useLiveViewerCount(streamId: string | null) {
  const [viewerCount, setViewerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!streamId) {
      setViewerCount(0)
      setLoading(false)
      return
    }

    let mounted = true

    // Initial fetch
    const getCount = async () => {
      const { data } = await supabase
        .from('streams')
        .select('current_viewers')
        .eq('id', streamId)
        .single()
      
      if (mounted && data) {
        setViewerCount(data.current_viewers || 0)
        setLoading(false)
      }
    }
    getCount()

    // Subscribe to DB updates (debounced by the host's 15s update interval)
    // REFACTOR: Changed from Realtime subscription to Polling to reduce DB connection costs
    const interval = setInterval(async () => {
        if (!mounted) return;
        const { data } = await supabase
            .from('streams')
            .select('current_viewers')
            .eq('id', streamId)
            .single();
        
        if (mounted && data) {
            setViewerCount(data.current_viewers || 0);
        }
    }, 15000); // Poll every 15s

    return () => {
      mounted = false
      clearInterval(interval);
    }
  }, [streamId])

  return { viewerCount, loading }
}
