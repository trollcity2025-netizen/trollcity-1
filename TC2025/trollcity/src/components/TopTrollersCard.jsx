import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TopTrollersCard = () => {
  const navigate = useNavigate();

  // Fetch top trollers by coin balance and followers
  const { data: topTrollers = [], isLoading } = useQuery({
    queryKey: ["topTrollers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, coins, follower_count, is_troll_officer, troll_family_name")
        .order("coins", { ascending: false })
        .limit(10);

      if (error) {
        console.warn("Failed to fetch top trollers:", error);
        return [];
      }

      return (data || []).map((troll, idx) => ({
        ...troll,
        rank: idx + 1,
      }));
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="bg-[#1a1a2e] border-purple-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-bold text-white">Top Trollers</h2>
        </div>
        <p className="text-gray-400">Loading...</p>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1a1a2e] border-purple-500/30 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Crown className="w-6 h-6 text-yellow-500" />
        <h2 className="text-xl font-bold text-white">👑 Top Trollers</h2>
      </div>

      {/* Leaderboard */}
      <div className="space-y-3">
        {topTrollers.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No users yet</p>
        ) : (
          topTrollers.map((troll, idx) => {
            const medalEmoji = 
              idx === 0 ? "🥇" : 
              idx === 1 ? "🥈" : 
              idx === 2 ? "🥉" : 
              `#${idx + 1}`;

            return (
              <div
                key={troll.id}
                onClick={() => navigate(`/PublicProfile?userId=${troll.id}`)}
                className="group relative bg-[#0f0f1a] hover:bg-purple-500/20 rounded-lg p-4 cursor-pointer transition-all duration-200 border border-purple-500/20 hover:border-purple-500/60"
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className="text-2xl font-bold text-yellow-500 w-8 text-center">
                    {medalEmoji}
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {troll.avatar_url ? (
                      <img
                        src={troll.avatar_url}
                        alt={troll.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl">👤</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white truncate">{troll.username}</p>
                      {troll.is_troll_officer && (
                        <Badge className="bg-purple-600/80 text-white text-xs">Officer</Badge>
                      )}
                      {troll.troll_family_name && (
                        <Badge className="bg-blue-600/80 text-white text-xs">
                          {troll.troll_family_name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">@{troll.username}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-purple-400 font-bold">
                        <Coins className="w-4 h-4" />
                        <span className="text-sm">{(troll.coins || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-400 text-xs">
                        <Users className="w-3 h-3" />
                        <span>{(troll.follower_count || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* View More Button */}
      <button
        onClick={() => navigate("/Trending")}
        className="w-full mt-4 py-2 px-4 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 font-semibold rounded-lg transition-colors duration-200"
      >
        View All →
      </button>
    </Card>
  );
};

export default TopTrollersCard;
