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
    <div className="flex items-center gap-2 text-sm text-slate-400 px-4 py-2">
      <Users size={16} />
      <span>{onlineCount} Online</span>
    </div>
  );
};

export default UserPresenceCounter;
