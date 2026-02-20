import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
// import { getUserEntranceEffect } from '../lib/entranceEffects'
import { usePresenceStore } from '../lib/presenceStore'

/**
 * Tracks viewer presence using Supabase Realtime.
 * - Viewers join the 'room:{streamId}' channel.
 * - Scalability: Aggregates counts and batches updates.
 * - Removes per-user join/leave chat spam.
 */
export function useViewerTracking(
  streamId: string | null,
  isHost: boolean = false,
  customUser: any = null,
  enabled: boolean = true
) {
  const { user, profile } = useAuthStore()
  const setRoomViewerCount = usePresenceStore(state => state.setRoomViewerCount)
  const lastDbUpdate = useRef<number>(0)
  const pendingCountRef = useRef<number | null>(null)
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Use customUser if provided (e.g. for Guests)
  const effectiveUser = user || customUser;

  const effectRan = useRef(false);

  useEffect(() => {
    if (!enabled || !streamId || !effectiveUser || effectRan.current) return;
    effectRan.current = true;

    // Only the Host and Officers track their presence to avoid roster explosion at 10k users.
    // Viewers just "listen" to the count updated by the host/officers in the DB.
    const isStaff = profile?.role === 'admin' || profile?.role === 'troll_officer' || profile?.is_troll_officer || profile?.is_admin;
    
    // Everyone tracks their presence now to populate the "Active Users" list.
    // For scalability at 10k+ users, we might need to throttle or limit this in the future.
    const shouldTrack = true;
    const isUpdateAuthorized = isHost || isStaff;

    const channel = supabase.channel(`room:${streamId}`, {
      config: {
        presence: {
          key: effectiveUser.id,
        },
      },
    })

    const updateCountsFromPresence = () => {
      const state = channel.presenceState();

      // Count unique keys (user_ids)
      let count = Object.keys(state).length;

      // If we are tracking ourselves but not yet in the sync state, 
      // ensure we count ourselves (at least 1)
      if (shouldTrack && count === 0) {
        count = 1;
      }

      // Scalability: Batch presence updates to 2 seconds
      pendingCountRef.current = count;
      if (!updateTimerRef.current) {
        updateTimerRef.current = setTimeout(() => {
          if (pendingCountRef.current !== null) {
            setRoomViewerCount(streamId, pendingCountRef.current);
            pendingCountRef.current = null;
          }
          updateTimerRef.current = null;
        }, 2000);
      }

      // Only Host OR Officer/Admin updates the DB count
      if (isUpdateAuthorized) {
        const now = Date.now();
        if (now - lastDbUpdate.current > 10000) { // Throttled to 10s
          lastDbUpdate.current = now;
          supabase.rpc('update_stream_viewer_count', { p_stream_id: streamId, p_count: count });
        }
      }
    };

    channel
      .on('presence', { event: 'sync' }, updateCountsFromPresence)
      .on('presence', { event: 'join' }, updateCountsFromPresence)
      .on('presence', { event: 'leave' }, updateCountsFromPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Everyone tracks themselves
          await channel.track({
            user_id: effectiveUser.id,
            username: profile?.username || effectiveUser.username || 'Guest',
            avatar_url: profile?.avatar_url || null,
            role: profile?.role || effectiveUser.role,
            troll_role: profile?.troll_role,
            joined_at: new Date().toISOString(),
          })

          // Also heartbeat into stream_viewers table for the "Active" list
          // Only for authenticated users (UUID required)
          if (user?.id) {
            console.log('Attempting to upsert stream_viewer with user:', user);
            await supabase.from('stream_viewers').upsert({
              stream_id: streamId,
              user_id: user.id,
              last_seen: new Date().toISOString()
            }, { onConflict: 'stream_id,user_id' });
          }
        }
      })

    // Heartbeat for stream_viewers table every 30s
    const heartbeatInterval = setInterval(async () => {
      if (streamId && user?.id) {
        console.log('Heartbeat: Attempting to upsert stream_viewer with user:', user);
        await supabase.from('stream_viewers').upsert({
          stream_id: streamId,
          user_id: user.id,
          last_seen: new Date().toISOString()
        }, { onConflict: 'stream_id,user_id' });
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      channel.untrack();
      supabase.removeChannel(channel);
      
      // Try to remove from stream_viewers on leave
      if (streamId && user?.id) {
        supabase.from('stream_viewers').delete().match({ stream_id: streamId, user_id: user.id });
      }
    }
  }, [streamId, user, isHost, profile, effectiveUser, setRoomViewerCount, enabled])

  // Get count from store instead of local state for consistency
  const storeCount = usePresenceStore(state => state.roomViewerCounts[streamId || ''] || 0)
  
  // For the broadcaster/host, ensure we show at least 1 viewer (themselves)
  // This provides immediate feedback before presence syncs.
  const viewerCount = (isHost && storeCount === 0) ? 1 : storeCount;

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
      // Thundering Herd Prevention: Jitter on fetch (0-500ms)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
      
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

    // Subscribe to DB updates (debounced by the host's 5s update interval)
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
    }, 5000); // Poll every 5s

    return () => {
      mounted = false
      clearInterval(interval);
    }
  }, [streamId])

  return { viewerCount, loading }
}
