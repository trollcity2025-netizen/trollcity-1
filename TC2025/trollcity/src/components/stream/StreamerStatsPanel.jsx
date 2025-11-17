import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Coins, Heart, Users } from "lucide-react";

const StreamerStatsPanel = ({ streamerId, streamId }) => {
  const [stats, setStats] = useState({
    coinsEarned: 0,
    likeCount: 0,
    followerCount: 0,
  });

  // Fetch streamer profile
  const { data: profile } = useQuery({
    queryKey: ["streamerProfile", streamerId],
    queryFn: async () => {
      if (!streamerId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, coins, follower_count, stream_coins_earned, like_count")
        .eq("id", streamerId)
        .single();
      if (error) {
        console.warn("Error fetching profile:", error);
        return null;
      }
      return data;
    },
    enabled: !!streamerId,
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Fetch like count for this stream
  const { data: likeCount = 0 } = useQuery({
    queryKey: ["streamLikeCount", streamId],
    queryFn: async () => {
      if (!streamId) return 0;
      const { count, error } = await supabase
        .from("stream_likes")
        .select("*", { count: "exact", head: true })
        .eq("stream_id", streamId);
      if (error) {
        console.warn("Error fetching likes:", error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!streamId,
    refetchInterval: 3000,
  });

  // Fetch total coins earned in current stream
  const { data: streamCoinsEarned = 0 } = useQuery({
    queryKey: ["streamCoinsEarned", streamId],
    queryFn: async () => {
      if (!streamId) return 0;
      const { data, error } = await supabase
        .from("stream_gifts")
        .select("coin_value")
        .eq("stream_id", streamId);
      if (error) {
        console.warn("Error fetching stream gifts:", error);
        return 0;
      }
      return (data || []).reduce((sum, gift) => sum + (gift.coin_value || 0), 0);
    },
    enabled: !!streamId,
    refetchInterval: 2000,
  });

  // Update local stats
  useEffect(() => {
    if (profile) {
      setStats({
        coinsEarned: streamCoinsEarned,
        likeCount: likeCount,
        followerCount: profile.follower_count || 0,
      });
    }
  }, [profile, likeCount, streamCoinsEarned]);

  if (!profile) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {/* Coins Earned This Stream */}
      <Card className="bg-gradient-to-br from-purple-600/40 to-purple-900/40 border-purple-500/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          <span className="text-xs text-gray-300 font-semibold">Coins (This Stream)</span>
        </div>
        <p className="text-2xl font-bold text-yellow-300">{stats.coinsEarned.toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-1">Total: {(profile.stream_coins_earned || 0).toLocaleString()}</p>
      </Card>

      {/* Like Count */}
      <Card className="bg-gradient-to-br from-red-600/40 to-red-900/40 border-red-500/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-5 h-5 text-red-400 fill-current" />
          <span className="text-xs text-gray-300 font-semibold">Likes</span>
        </div>
        <p className="text-2xl font-bold text-red-300">{stats.likeCount.toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-1">Profile: {(profile.like_count || 0).toLocaleString()}</p>
      </Card>

      {/* Follower Count */}
      <Card className="bg-gradient-to-br from-blue-600/40 to-blue-900/40 border-blue-500/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-blue-400" />
          <span className="text-xs text-gray-300 font-semibold">Followers</span>
        </div>
        <p className="text-2xl font-bold text-blue-300">{stats.followerCount.toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-1">You have {stats.followerCount} followers</p>
      </Card>
    </div>
  );
};

export default StreamerStatsPanel;
