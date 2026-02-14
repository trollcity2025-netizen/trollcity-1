import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Gift, Crown, Flame } from 'lucide-react';
import { getGlowingTextStyle } from '../lib/perkEffects';

interface TopBroadcaster {
  user_id: string;
  username: string;
  avatar_url?: string;
  total_gifts: number;
  level?: number;
  glowing_username_color?: string;
  is_gold?: boolean;
  rgb_username_expires_at?: string;
}

export default function TopBroadcastersGrid() {
  const [broadcasters, setBroadcasters] = useState<TopBroadcaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopBroadcasters();
  }, []);

  const fetchTopBroadcasters = async () => {
    try {
      // Get top 4 broadcasters by gift amount in last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from('gift_transactions')
        .select('recipient_id, amount', { count: 'exact' })
        .gte('created_at', yesterday.toISOString())
        .order('amount', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('Gift transactions not available:', error);
        setLoading(false);
        return;
      }

      // Get user profiles for recipients
      const recipientIds = [...new Set(data?.map((t: any) => t.recipient_id) || [])];
      
      if (recipientIds.length === 0) {
        setBroadcasters([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, level, glowing_username_color, is_gold, rgb_username_expires_at')
        .in('id', recipientIds);

      // Aggregate by user
      const aggregated = new Map<string, TopBroadcaster>();
      
      data?.forEach((transaction: any) => {
        const userId = transaction.recipient_id;
        const profile = profiles?.find((p: any) => p.id === userId);
        const existing = aggregated.get(userId);
        
        if (existing) {
          existing.total_gifts += transaction.amount;
        } else {
          aggregated.set(userId, {
            user_id: userId,
            username: profile?.username || 'Unknown',
            avatar_url: profile?.avatar_url,
            total_gifts: transaction.amount,
            level: profile?.level,
            glowing_username_color: profile?.glowing_username_color,
            is_gold: profile?.is_gold,
            rgb_username_expires_at: profile?.rgb_username_expires_at
          });
        }
      });

      // Sort and get top 4
      const top = Array.from(aggregated.values())
        .sort((a, b) => b.total_gifts - a.total_gifts)
        .slice(0, 4);

      setBroadcasters(top);
    } catch (error) {
      console.warn('Error fetching top broadcasters:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 bg-slate-800/60 rounded-2xl border border-white/10 animate-pulse">
            <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-4" />
            <div className="h-4 bg-slate-700 rounded w-24 mx-auto mb-2" />
            <div className="h-3 bg-slate-700 rounded w-20 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (broadcasters.length === 0) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-8 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 text-center">
            <Flame className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-white mb-2">
              Waiting for #{i}
            </h3>
            <p className="text-sm text-slate-400">
              Be the top gifter to appear here
            </p>
          </div>
        ))}
      </div>
    );
  }

  // Pad with placeholder cards if less than 4
  const displayBroadcasters: TopBroadcaster[] = [
    ...broadcasters,
    ...Array.from({ length: Math.max(0, 4 - broadcasters.length) }).map((_, i) => ({
      user_id: `placeholder-${i}`,
      username: `Coming Soon #${broadcasters.length + i + 1}`,
      avatar_url: undefined,
      total_gifts: 0,
      level: undefined,
      is_gold: false,
      rgb_username_expires_at: undefined,
      glowing_username_color: undefined
    }))
  ];

  return (
    <>
      <style>
        {`
          @keyframes rgb-rotate {
            0% { filter: hue-rotate(0deg); }
            100% { filter: hue-rotate(360deg); }
          }
          .top-broadcaster-card {
            position: relative;
            border: 3px solid;
            border-image: linear-gradient(45deg, #ff0080, #ff8c00, #40e0d0, #ff0080) 1;
            animation: rgb-rotate 3s linear infinite;
          }
        `}
      </style>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayBroadcasters.map((broadcaster, index) => (
          <div
            key={broadcaster.user_id}
            className={`group relative p-6 rounded-2xl transition-all duration-500 top-broadcaster-card ${
              index === 0
                ? 'bg-gradient-to-br from-amber-600/30 via-orange-600/20 to-red-600/20 shadow-[0_0_30px_rgba(251,191,36,0.3)] hover:shadow-[0_0_40px_rgba(251,191,36,0.5)]'
                : index === 1
                ? 'bg-gradient-to-br from-slate-600/30 via-slate-700/20 to-slate-800/20 shadow-[0_0_30px_rgba(100,116,139,0.3)] hover:shadow-[0_0_40px_rgba(100,116,139,0.5)]'
                : index === 2
                ? 'bg-gradient-to-br from-orange-600/30 via-amber-600/20 to-yellow-600/20 shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:shadow-[0_0_40px_rgba(249,115,22,0.5)]'
                : 'bg-gradient-to-br from-slate-900/50 to-slate-800/50 shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:shadow-[0_0_30px_rgba(56,189,248,0.2)]'
            } hover:scale-105 cursor-pointer text-center`}
          >
            {/* Crown and Coins on Top */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1">
              <Crown className="w-6 h-6 text-amber-400 animate-pulse" />
              <div className="flex gap-0.5">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg" />
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg" />
              </div>
            </div>
          {/* Rank Badge */}
          <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center text-sm font-black text-white shadow-lg border-2 border-white/20">
            {index + 1}
          </div>

          {/* Avatar */}
          <div className="relative mb-4 flex justify-center">
            <div className={`w-24 h-24 rounded-full overflow-hidden border-4 flex items-center justify-center ${
              index === 0
                ? 'border-amber-400/60 shadow-[0_0_25px_rgba(251,191,36,0.4)] bg-gradient-to-br from-amber-500 to-orange-600'
                : index === 1
                ? 'border-slate-400/60 shadow-[0_0_25px_rgba(100,116,139,0.4)] bg-gradient-to-br from-slate-600 to-slate-700'
                : index === 2
                ? 'border-orange-400/60 shadow-[0_0_25px_rgba(249,115,22,0.4)] bg-gradient-to-br from-orange-500 to-amber-600'
                : 'border-slate-500/40 shadow-[0_0_20px_rgba(100,116,139,0.2)] bg-gradient-to-br from-slate-700 to-slate-800'
            }`}>
              {broadcaster.avatar_url ? (
                <img src={broadcaster.avatar_url} alt={broadcaster.username} className="w-full h-full object-cover" />
              ) : (
                <Crown className="w-10 h-10 text-white opacity-60" />
              )}
            </div>
            {index < 3 && (
              <Flame className={`absolute bottom-0 right-0 w-6 h-6 ${
                index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-400' : 'text-orange-400'
              }`} />
            )}
          </div>

          {/* Username */}
          {(() => {
            const isGold = broadcaster.is_gold;
            const hasRgb = broadcaster.rgb_username_expires_at && new Date(broadcaster.rgb_username_expires_at) > new Date();
            let className = "text-lg font-bold text-white mb-1 truncate px-2";
            let style = {};

            if (isGold) {
              className += " gold-username";
            } else if (hasRgb) {
              className += " rgb-username";
            } else if (broadcaster.glowing_username_color) {
              style = getGlowingTextStyle(broadcaster.glowing_username_color);
            }

            return (
              <h3 
                className={className}
                style={style}
              >
                {broadcaster.username}
              </h3>
            );
          })()}

          {/* Level */}
          {broadcaster.level && (
            <div className="inline-block mb-3 px-2.5 py-1 bg-purple-600/60 rounded-full text-white text-xs font-bold border border-purple-400/30">
              Level {broadcaster.level}
            </div>
          )}

          {/* Gift Amount */}
          <div className={`flex items-center justify-center gap-1.5 text-sm font-bold ${
            broadcaster.total_gifts > 0
              ? index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-orange-400' : 'text-slate-300'
              : 'text-slate-500'
          }`}>
            <Gift className="w-4 h-4" />
            <span>${broadcaster.total_gifts.toLocaleString()}</span>
          </div>

          {/* Status text */}
          {broadcaster.total_gifts === 0 && (
            <p className="text-xs text-slate-500 mt-2">
              Waiting for gifts...
            </p>
          )}
        </div>
      ))}
    </div>
    </>
  );
}
