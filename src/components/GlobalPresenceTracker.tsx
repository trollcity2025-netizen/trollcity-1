import { useEffect, useRef } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { usePresenceStore } from '../lib/presenceStore';

/**
 * GlobalPresenceTracker - tracks user presence and visibility
 * - Sends heartbeat every 30 seconds to keep user "online"
 * - Updates is_online status based on visibility (visible = online, hidden = offline)
 * - Does NOT log out users - just tracks presence
 */
export default function GlobalPresenceTracker() {
  const { user } = useAuthStore();
  const setOnlineCount = usePresenceStore(state => state.setOnlineCount);
  const setOnlineUserIds = usePresenceStore(state => state.setOnlineUserIds);
  const isVisibleRef = useRef<boolean>(true);
  const lastOnlineUpdateRef = useRef<number>(0);

  // Update user's online status in database
  const updateOnlineStatus = async (isOnline: boolean) => {
    if (!user?.id) return;
    
    // Debounce - don't update more than every 10 seconds if same status
    const now = Date.now();
    if (now - lastOnlineUpdateRef.current < 10000 && isOnline === isVisibleRef.current) return;
    
    lastOnlineUpdateRef.current = now;
    isVisibleRef.current = isOnline;

    try {
      // Update user_profiles is_online status
      await supabase
        .from('user_profiles')
        .update({
          is_online: isOnline,
          last_active: new Date().toISOString()
        })
        .eq('id', user.id);

      // Also update active_sessions if we have a session ID
      const sessionId = localStorage.getItem('current_device_session_id');
      if (sessionId) {
        await supabase
          .from('active_sessions')
          .update({
            is_active: isOnline,
            last_active: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('session_id', sessionId);
      }
    } catch (error) {
      console.error('[GlobalPresenceTracker] Failed to update online status:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    // Initial: user is online when app opens
    updateOnlineStatus(true);

    // Heartbeat & Count fetch
    const syncPresence = async () => {
      try {
        // 1. Send heartbeat
        await supabase.rpc('heartbeat_presence');
        
        // 2. Fetch total online count and user IDs (approximate from user_presence table)
        // This replaces the expensive Realtime Presence Roster at 10k users.
        // Includes ALL users: regular users, admins, officers, etc.
        const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
        const { data: presenceData, count, error } = await supabase
          .from('user_presence')
          .select('user_id', { count: 'exact' })
          .gt('last_seen_at', twoMinutesAgo)
          .limit(1000); // Get up to 1000 online users to show in sidebar
        
        if (!error) {
          if (count !== null) {
            setOnlineCount(count);
          }
          // Also store the user IDs for the GlobalUserCounter
          if (presenceData) {
            const userIds = presenceData.map(p => p.user_id).filter(Boolean);
            setOnlineUserIds(userIds);
          }
        }
      } catch (err) {
        console.error('Presence sync failed:', err);
      }
    };

    syncPresence();

    // Sync every 30 seconds
    const interval = setInterval(syncPresence, 30000);

    // Handle visibility changes - update online status when tab becomes visible/hidden
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      console.log('[GlobalPresenceTracker] Visibility changed:', isVisible ? 'visible' : 'hidden');
      
      // Only send heartbeat when becoming visible again
      if (isVisible) {
        syncPresence();
      }
      
      // Update online status based on visibility
      updateOnlineStatus(isVisible);
    };

    // Handle beforeunload - mark as offline but don't logout
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable async update on page close
      const sessionId = localStorage.getItem('current_device_session_id');
      if (user?.id) {
        // Mark as offline in user_profiles
        const payload = JSON.stringify({
          is_online: false,
          last_active: new Date().toISOString()
        });
        
        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}`,
          payload
        );
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for page close
    window.addEventListener('beforeunload', handleBeforeUnload);

    // We keep the channel but DO NOT track presence.
    // This allows us to still receive broadcast events if needed without the roster cost.
    const channel = supabase.channel('global_metrics');
    channel.subscribe();

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      supabase.removeChannel(channel);
      
      // Mark as offline when component unmounts (e.g., user navigates away or logs out)
      updateOnlineStatus(false);
    };
  }, [user?.id, setOnlineCount, setOnlineUserIds]);

  return null;
}
