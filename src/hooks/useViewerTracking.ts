import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { getUserEntranceEffect } from '../lib/entranceEffects'

/**
 * Tracks viewer presence using Supabase Realtime.
 * - Viewers join the 'room:{streamId}' channel.
 * - The Host (broadcaster) is responsible for periodically updating the 'streams' table
 *   with the accurate viewer count to avoid DB write storms.
 * - Posts join/leave messages to stream chat
 */
export function useViewerTracking(streamId: string | null, isHost: boolean = false, customUser: any = null) {
  const { user, profile } = useAuthStore()
  const [viewerCount, setViewerCount] = useState<number | undefined>(undefined)
  const lastDbUpdate = useRef<number>(0)

  // Use customUser if provided (e.g. for Guests)
  const effectiveUser = user || customUser;

  useEffect(() => {
    if (!streamId || !effectiveUser) return

    const channel = supabase.channel(`room:${streamId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        
        // Count unique user_ids (deduplicate multiple tabs/connections)
        const uniqueUsers = new Set();
        Object.values(state).forEach((presences: any) => {
            presences.forEach((p: any) => {
                if (p.user_id) uniqueUsers.add(p.user_id);
            });
        });
        
        const count = uniqueUsers.size;
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
          if (now - lastDbUpdate.current > 5000) { // Update every 5s
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
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Post join message to chat
        newPresences.forEach((p: any) => {
          if (p.user_id && p.username) {
            // Fetch user level for the message
            supabase.from('user_profiles')
              .select('level')
              .eq('id', p.user_id)
              .single()
              .then(({ data }) => {
                const level = data?.level || 1;
                supabase.rpc('post_system_message', {
                  p_stream_id: streamId,
                  p_user_id: p.user_id,
                  p_content: `${p.username} [Lvl ${level}] entered`,
                  p_username: p.username,
                  p_avatar_url: p.avatar_url,
                  p_role: p.role,
                  p_troll_role: p.troll_role
                });
              });
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        // Post leave message to chat
        leftPresences.forEach((p: any) => {
          if (p.user_id && p.username) {
            // Fetch user level for the message
            supabase.from('user_profiles')
              .select('level')
              .eq('id', p.user_id)
              .single()
              .then(({ data }) => {
                const level = data?.level || 1;
                supabase.rpc('post_system_message', {
                  p_stream_id: streamId,
                  p_user_id: p.user_id,
                  p_content: `${p.username} [Lvl ${level}] left`,
                  p_username: p.username,
                  p_avatar_url: p.avatar_url,
                  p_role: p.role,
                  p_troll_role: p.troll_role
                });
              });
          }
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Fetch entrance effect before tracking
          let entranceEffect = null;
          if (user) {
            try {
               const effectData = await getUserEntranceEffect(user.id);
               if (effectData?.config) {
                   entranceEffect = effectData.config;
               }
            } catch (e) {
               console.error('Failed to load entrance effect:', e);
            }
          }

          await channel.track({
            user_id: effectiveUser.id,
            username: profile?.username || effectiveUser.username || 'Guest',
            avatar_url: profile?.avatar_url || effectiveUser.avatar_url,
            role: profile?.role || effectiveUser.role,
            troll_role: profile?.troll_role || effectiveUser.troll_role,
            joined_at: new Date().toISOString(),
            entrance_effect: entranceEffect
          })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [streamId, user, isHost, profile, effectiveUser])

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
