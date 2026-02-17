import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Gift, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getGlowingTextStyle } from '../../lib/perkEffects';

interface LeaderboardRow {
  sender_id: string;
  total_coins: number;
  gift_count: number;
  last_gift_at: string | null;
}

interface SupporterProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  glowing_username_color?: string | null;
  is_gold?: boolean | null;
  rgb_username_expires_at?: string | null;
}

interface SupporterEntry extends LeaderboardRow {
  profile?: SupporterProfile | null;
}

interface StreamGiftStatsProps {
  streamId: string;
}

export default function StreamGiftStats({ streamId }: StreamGiftStatsProps) {
  const [loading, setLoading] = useState(true);
  const [totalCoins, setTotalCoins] = useState(0);
  const [leaderboard, setLeaderboard] = useState<SupporterEntry[]>([]);

  const fetchStats = useCallback(async () => {
    if (!streamId) return;

    try {
      const [{ data: totalData, error: totalError }, { data: leaderboardData, error: leaderboardError }] = await Promise.all([
        supabase.rpc('get_stream_gift_total', { p_stream_id: streamId }),
        supabase.rpc('get_stream_gift_leaderboard', { p_stream_id: streamId, p_limit: 5 })
      ]);

      if (totalError) {
        throw totalError;
      }
      if (leaderboardError) {
        throw leaderboardError;
      }

      const resolvedTotal = Array.isArray(totalData) ? totalData[0]?.total_coins : totalData?.total_coins ?? totalData;
      setTotalCoins(Number(resolvedTotal || 0));

      const rows: LeaderboardRow[] = Array.isArray(leaderboardData) ? leaderboardData : [];
      const senderIds = rows.map((row) => row.sender_id).filter(Boolean);

      let profiles: SupporterProfile[] = [];
      if (senderIds.length > 0) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, glowing_username_color, is_gold, rgb_username_expires_at')
          .in('id', senderIds);

        profiles = profileData || [];
      }

      const merged = rows.map((row) => ({
        ...row,
        total_coins: Number(row.total_coins || 0),
        gift_count: Number(row.gift_count || 0),
        profile: profiles.find((profile) => profile.id === row.sender_id) || null
      }));

      setLeaderboard(merged);
    } catch (error) {
      console.error('[StreamGiftStats] Failed to fetch gift stats:', error);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    if (!streamId) return;

    fetchStats();

    const channel = supabase
      .channel(`stream_gifts_${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_gifts',
          filter: `stream_id=eq.${streamId}`
        },
        () => fetchStats()
      )
      .subscribe();

    const interval = setInterval(fetchStats, 5000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [streamId, fetchStats]);

  const remainingSupporters = useMemo(() => leaderboard.slice(0, 5), [leaderboard]);

  const getNameClass = (profile?: SupporterProfile | null) => {
    if (!profile) return 'text-white';
    if (profile.is_gold) return 'gold-username';
    if (profile.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date()) return 'rgb-username';
    return 'text-white';
  };

  const getNameStyle = (profile?: SupporterProfile | null) => {
    if (profile?.glowing_username_color) return getGlowingTextStyle(profile.glowing_username_color);
    return undefined;
  };

  return (
    <div className="border-b border-white/10 bg-zinc-950/95 px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400 font-bold">
          <Gift className="w-4 h-4 text-yellow-400" />
          Stream Gifts
        </div>
        <div className="text-sm font-black text-yellow-400">
          {totalCoins.toLocaleString()} coins
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : remainingSupporters.length === 0 ? (
        <div className="text-xs text-zinc-500 py-4">
          No gifts yet. Be the first supporter.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {remainingSupporters.map((supporter, index) => {
            const profile = supporter.profile;
            const isTop = index === 0;

            return (
              <div
                key={supporter.sender_id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  isTop ? 'border-yellow-400/40 bg-yellow-500/10' : 'border-white/5 bg-white/5'
                }`}
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden border border-white/10">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile?.username || 'Supporter'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                        {profile?.username?.[0]?.toUpperCase() || 'S'}
                      </div>
                    )}
                  </div>
                  {isTop && (
                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-black rounded-full p-1 shadow-lg">
                      <Crown className="w-3 h-3" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-bold truncate ${getNameClass(profile)}`}
                    style={getNameStyle(profile)}
                  >
                    {profile?.username || 'Supporter'}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {supporter.gift_count} gifts
                  </div>
                </div>

                <div className="text-right">
                  {isTop && (
                    <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
                      Top supporter
                    </div>
                  )}
                  <div className="text-sm font-black text-white">
                    {supporter.total_coins.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
