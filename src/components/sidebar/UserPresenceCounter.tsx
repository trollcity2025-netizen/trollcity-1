import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Users } from 'lucide-react';

const UserPresenceCounter = () => {
  const { profile } = useAuthStore();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase.channel('global-presence', {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    const updateOnlineCount = () => {
      const presenceState = channel.presenceState();
      const userIds = Object.keys(presenceState).length;
      setOnlineCount(userIds);
    };

    channel.on('presence', { event: 'sync' }, updateOnlineCount);
    channel.on('presence', { event: 'join' }, updateOnlineCount);
    channel.on('presence', { event: 'leave' }, updateOnlineCount);

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  return (
    <span className="text-xs text-slate-400">
      {onlineCount}
    </span>
  );
};

export default UserPresenceCounter;
