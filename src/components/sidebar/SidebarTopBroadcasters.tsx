import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
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
  const [broadcasters, setBroadcasters] = useState<TopBroadcaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopBroadcasters();
    
    // Refresh every minute to "rotate" or update stats
    const interval = setInterval(fetchTopBroadcasters, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchTopBroadcasters = async () => {
    try {
      // 1. Get top broadcasters from stats (last 24h) - Scalable Read
      const { data: statsData, error: statsError } = await supabase
        .from('broadcaster_stats')
        .select('user_id, total_gifts_24h')
        .order('total_gifts_24h', { ascending: false })
        .limit(50);

      if (statsError) throw statsError;

      const giftMap = new Map<string, number>();
      statsData?.forEach((s: any) => {
        giftMap.set(s.user_id, s.total_gifts_24h);
      });
      
      const broadcasterIds = Array.from(giftMap.keys());
      
      // 2. Get users with active top_broadcaster feature (purchased)
      const { data: featuredData } = await supabase
        .rpc('get_top_broadcasters_with_featured');

      // Add featured users to the map if not already present
      if (featuredData && featuredData.length > 0) {
        featuredData.forEach((f: any) => {
          if (!broadcasterIds.includes(f.user_id)) {
            broadcasterIds.push(f.user_id);
            // Give them a boost in ranking (use 1 as placeholder, will be sorted by recency)
            giftMap.set(f.user_id, 1);
          }
        });
      }

      if (broadcasterIds.length === 0) {
          setBroadcasters([]);
          setLoading(false);
          return;
      }

      // 3. Check live status for these users
      const { data: streams } = await supabase
        .from('streams')
        .select('broadcaster_id, id, is_live')
        .in('broadcaster_id', broadcasterIds)
        .eq('is_live', true);

      const liveMap = new Map<string, string>(); // userId -> streamId
      streams?.forEach((s: any) => liveMap.set(s.broadcaster_id, s.id));

      // 4. Fetch profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', broadcasterIds);

      // 5. Combine data
      const combined: TopBroadcaster[] = [];
      const featuredIds = new Set(featuredData?.map((f: any) => f.user_id) || []);
      
      profiles?.forEach((p: any) => {
        combined.push({
          user_id: p.id,
          username: p.username,
          avatar_url: p.avatar_url,
          total_gifts: giftMap.get(p.id) || 0,
          is_live: liveMap.has(p.id),
          stream_id: liveMap.get(p.id)
        });
      });

      // Sort by: featured users first, then by gifts
      combined.sort((a, b) => {
        const aFeatured = featuredIds.has(a.user_id);
        const bFeatured = featuredIds.has(b.user_id);
        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;
        return b.total_gifts - a.total_gifts;
      });

      // Take top 5
      setBroadcasters(combined.slice(0, 5));
    } catch (err) {
      console.error('Error fetching sidebar broadcasters:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || broadcasters.length === 0) return null;

  return (
    <div className={`mb-6 ${isCollapsed ? 'px-2' : 'px-4'}`}>
      {!isCollapsed && (
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Crown className="w-3 h-3 text-yellow-500" />
          Top Broadcasters
        </h3>
      )}
      <div className="space-y-3">
        {broadcasters.map((broadcaster, index) => (
          <div key={broadcaster.user_id} className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} group relative`}>
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
               {/* Rank Badge */}
               <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] font-bold text-black border border-[#0A0814]">
                 {index + 1}
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

             {/* Live/Watch Button - Only visible when expanded or maybe show small icon if collapsed? */}
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
        ))}
      </div>
    </div>
  );
}
