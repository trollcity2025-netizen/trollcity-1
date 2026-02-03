import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from 'lucide-react';
import UserActionModal from './UserActionModal';
import EntranceEffectOverlay from './EntranceEffectOverlay';

interface ActiveUserStripProps {
  streamId: string;
  isHost: boolean;
  isModerator: boolean;
  onGift: (userId: string) => void;
}

interface Viewer {
  user_id: string;
  user: {
    username: string;
    avatar_url: string | null;
    role?: string;
    troll_role?: string;
    created_at?: string;
    active_entrance_effect?: string;
  };
}

export default function ActiveUserStrip({ streamId, isHost, isModerator, onGift }: ActiveUserStripProps) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const prevViewersRef = useRef<Set<string>>(new Set());
  
  // Entrance Effect Queue
  const [effectQueue, setEffectQueue] = useState<Array<{ effectId: string, username: string, avatarUrl?: string }>>([]);
  const [currentEffect, setCurrentEffect] = useState<{ effectId: string, username: string, avatarUrl?: string } | null>(null);

  useEffect(() => {
    const fetchViewers = async () => {
      // Fetch viewers active in the last 5 minutes
      const { data, error } = await supabase
        .from('stream_viewers')
        .select('user_id, user:user_profiles(username, avatar_url, role, troll_role, created_at, active_entrance_effect)')
        .eq('stream_id', streamId)
        .gt('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(20);

      if (data) {
        // @ts-ignore
        const newViewers = data as Viewer[];
        
        // Detect new viewers for effects
        const prevIds = prevViewersRef.current;
        const currentIds = new Set(newViewers.map(v => v.user_id));
        
        // Find users who are in newViewers but were NOT in prevIds
        // We also need to make sure we don't trigger for initial load if we want (or maybe we do?)
        // Let's trigger for initial load only if it's not the VERY first load? 
        // Actually, preventing initial load flood is good.
        if (prevIds.size > 0) {
            newViewers.forEach(v => {
                if (!prevIds.has(v.user_id) && v.user.active_entrance_effect) {
                    // New user with effect!
                    setEffectQueue(prev => [...prev, {
                        effectId: v.user.active_entrance_effect!,
                        username: v.user.username,
                        avatarUrl: v.user.avatar_url || undefined
                    }]);
                }
            });
        }

        // Update ref
        prevViewersRef.current = currentIds;
        setViewers(newViewers);
      }
    };

    fetchViewers();
    const interval = setInterval(fetchViewers, 30000); // Refresh every 30s

    // Realtime subscription for immediate updates
    const channel = supabase
      .channel(`active_viewers:${streamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stream_viewers',
        filter: `stream_id=eq.${streamId}`
      }, () => {
        fetchViewers();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Process Effect Queue
  useEffect(() => {
    if (!currentEffect && effectQueue.length > 0) {
        const next = effectQueue[0];
        setCurrentEffect(next);
        setEffectQueue(prev => prev.slice(1));
    }
  }, [currentEffect, effectQueue]);

  return (
    <>
      <div className="w-full h-16 bg-zinc-900/80 backdrop-blur-sm border-b border-white/10 flex items-center px-4 gap-2 overflow-x-auto scrollbar-hide z-40">
      {viewers.map((v) => (
        <button
          key={v.user_id}
          onClick={() => setSelectedUser(v.user_id)}
          className="relative group flex-shrink-0"
        >
          <div className="w-10 h-10 rounded-full border-2 border-transparent hover:border-yellow-500 transition-all overflow-hidden bg-zinc-800">
            {v.user.avatar_url ? (
              <img src={v.user.avatar_url} alt={v.user.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                <User size={20} />
              </div>
            )}
          </div>
          {/* Online Indicator */}
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900" />
        </button>
      ))}
      
      {viewers.length === 0 && (
        <span className="text-zinc-500 text-sm italic">Waiting for viewers...</span>
      )}

      {selectedUser && (
        <UserActionModal
          streamId={streamId}
          userId={selectedUser}
          username={viewers.find(v => v.user_id === selectedUser)?.user.username}
          createdAt={viewers.find(v => v.user_id === selectedUser)?.user.created_at}
          isHost={isHost}
          isModerator={isModerator}
          onClose={() => setSelectedUser(null)}
          onGift={() => {
            onGift(selectedUser);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
    
    {currentEffect && (
        <EntranceEffectOverlay 
            effectId={currentEffect.effectId}
            username={currentEffect.username}
            avatarUrl={currentEffect.avatarUrl}
            onComplete={() => setCurrentEffect(null)}
        />
    )}
    </>
  );
}
