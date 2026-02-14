import { useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { usePresenceStore } from '../lib/presenceStore';

export default function GlobalPresenceTracker() {
  const { user } = useAuthStore();
  const setOnlineCount = usePresenceStore(state => state.setOnlineCount);

  useEffect(() => {
    if (!user?.id) return;

    // Heartbeat & Count fetch
    const syncPresence = async () => {
      try {
        // 1. Send heartbeat
        await supabase.rpc('heartbeat_presence');
        
        // 2. Fetch total online count (approximate from user_presence table)
        // This replaces the expensive Realtime Presence Roster at 10k users.
        const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
        const { count, error } = await supabase
          .from('user_presence')
          .select('*', { count: 'exact', head: true })
          .gt('last_seen_at', twoMinutesAgo);
        
        if (!error && count !== null) {
          setOnlineCount(count);
        }
      } catch (err) {
        console.error('Presence sync failed:', err);
      }
    };

    syncPresence();

    // Sync every 30 seconds
    const interval = setInterval(syncPresence, 30000);

    // We keep the channel but DO NOT track presence.
    // This allows us to still receive broadcast events if needed without the roster cost.
    const channel = supabase.channel('global_metrics');

    channel.subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user?.id, setOnlineCount]);

  return null;
}
