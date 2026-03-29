import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Crown, Gift, Video } from 'lucide-react';

interface TopBroadcaster {
  user_id: string;
  username: string;
  avatar_url?: string;
  total_gifts: number;
  is_live: boolean;
  stream_id?: string;
}

interface SidebarTopBroadcastersProps {
  isCollapsed: boolean;
}

export default function SidebarTopBroadcasters({ isCollapsed }: SidebarTopBroadcastersProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [broadcaster, setBroadcaster] = useState<TopBroadcaster | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTopBroadcaster = useCallback(async () => {
    try {
      // 1. Get start of current week (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      // 2. Query gift_ledger for gifts received this week, aggregated by receiver
      const { data: giftData, error: giftError } = await supabase
        .from('gift_ledger')
        .select('receiver_id, amount')
        .eq('status', 'processed')
        .gte('created_at', startOfWeek.toISOString());

      if (giftError) throw giftError;

      // 3. Aggregate gifts per broadcaster, excluding current user
      const giftMap = new Map<string, number>();
      giftData?.forEach((g: any) => {
        if (g.receiver_id === user?.id) return;
        const current = giftMap.get(g.receiver_id) || 0;
        giftMap.set(g.receiver_id, current + (g.amount || 0));
      });

      // 4. Sort by total gifts, take only the #1
      const sorted = Array.from(giftMap.entries())
        .sort((a, b) => b[1] - a[1]);

      if (sorted.length === 0) {
        setBroadcaster(null);
        setLoading(false);
        return;
      }

      const [topId, topGifts] = sorted[0];

      // 5. Check live status
      const { data: streams } = await supabase
        .from('streams')
        .select('broadcaster_id, id, is_live')
        .eq('broadcaster_id', topId)
        .eq('is_live', true);

      const liveStreamId = streams?.[0]?.id;

      // 6. Fetch profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .eq('id', topId)
        .maybeSingle();

      if (profile) {
        setBroadcaster({
          user_id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          total_gifts: topGifts,
          is_live: !!liveStreamId,
          stream_id: liveStreamId
        });
      }
    } catch (err) {
      console.error('Error fetching sidebar broadcaster:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTopBroadcaster();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchTopBroadcaster, 120000);
    return () => clearInterval(interval);
  }, [fetchTopBroadcaster]);

  if (loading || !broadcaster) return null;

  return (
    <div className={`mb-6 ${isCollapsed ? 'px-2' : 'px-4'}`}>
      {!isCollapsed && (
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Crown className="w-3 h-3 text-yellow-500" />
          Top Broadcaster
        </h3>
      )}
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} group relative`}>
         {/* Avatar Section */}
         <div 
           className="relative cursor-pointer"
           onClick={() => navigate(`/profile/${broadcaster.username}`)}
           title={isCollapsed ? broadcaster.username : undefined}
         >
           <div className={`w-10 h-10 rounded-full p-0.5 ${broadcaster.is_live ? 'bg-gradient-to-r from-red-500 to-pink-500 animate-pulse' : 'bg-gray-700'}`}>
             <img 
               src={broadcaster.avatar_url || `https://ui-avatars.com/api/?name=${broadcaster.username}`} 
               alt={broadcaster.username}
               className="w-full h-full rounded-full object-cover border-2 border-[#0A0814]"
             />
           </div>
           {/* Crown Badge */}
           <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] font-bold text-black border border-[#0A0814]">
             <Crown className="w-2.5 h-2.5" />
           </div>
         </div>

         {/* Info Section - Only visible when expanded */}
         {!isCollapsed && (
           <div className="flex-1 min-w-0">
             <div className="flex items-center justify-between">
               <p 
                  className="text-sm font-medium text-white truncate cursor-pointer hover:text-purple-400 transition-colors"
                  onClick={() => navigate(`/profile/${broadcaster.username}`)}
               >
                 {broadcaster.username}
               </p>
             </div>
             <div className="flex items-center gap-2 text-xs text-gray-400">
               <span className="flex items-center gap-1 text-yellow-400">
                 <Gift className="w-3 h-3" />
                 {broadcaster.total_gifts.toLocaleString()}
               </span>
             </div>
           </div>
         )}

         {/* Live/Watch Button - Only visible when expanded */}
         {!isCollapsed && broadcaster.is_live && (
           <button
             onClick={() => navigate(`/live/${broadcaster.stream_id}`)}
             className="p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all group/btn"
             title="Watch Live"
           >
             <Video className="w-4 h-4" />
           </button>
         )}
      </div>
    </div>
  );
}
