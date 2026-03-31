import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Home, Trophy, Coins, Gift, Heart, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

interface StreamStats {
  title: string;
  totalLikes: number;
  createdAt: string;
  endedAt?: string;
  broadcasterId: string;
}

interface UserStats {
  trollmondsSpent: number;
  giftsReceived: number;
  newFollowers: number;
}

export default function StreamSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { streamId } = useParams();
  const { user, profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    trollmondsSpent: 0,
    giftsReceived: 0,
    newFollowers: 0
  });
  const [isBroadcaster, setIsBroadcaster] = useState(false);

  useEffect(() => {
    if (!streamId) {
      setLoading(false);
      return;
    }

    const fetchStreamStats = async () => {
      try {
        // Get stream info with timing data
        const { data: stream, error } = await supabase
          .from('streams')
          .select('title, total_likes, created_at, ended_at, user_id')
          .eq('id', streamId)
          .single();

        if (error) throw error;

        const broadcasterId = stream?.user_id || '';
        const streamCreatedAt = stream?.created_at || new Date().toISOString();
        const streamEndedAt = stream?.ended_at || new Date().toISOString();

        setStreamStats({
          title: stream?.title || 'Stream Ended',
          totalLikes: stream?.total_likes || 0,
          createdAt: streamCreatedAt,
          endedAt: streamEndedAt,
          broadcasterId
        });

        // Check if current user is the broadcaster
        const userIsBroadcaster = user?.id === broadcasterId;
        setIsBroadcaster(userIsBroadcaster);

        // Initialize user stats
        let trollmondsSpent = 0;
        let giftsReceived = 0;
        let newFollowers = 0;

        if (user?.id) {
          console.log('[StreamSummary] Fetching gift data for user:', user.id, 'stream:', streamId);

          // Get sender's current trollmond balance to determine if trollmonds were actually used
          // Users with < 100 trollmonds do not get the trollmond deduction (they pay full troll coin price)
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('trollmonds')
            .eq('id', user.id)
            .single();

          const senderTrollmonds = userProfile?.trollmonds || 0;

          // 1. Get trollmonds spent by this user (as sender)
          // Only count trollmonds if sender had 100+ (the threshold for trollmond deduction)
          const { data: streamGiftsSpent, error: streamGiftsSpentError } = await supabase
            .from('stream_gifts')
            .select('id, quantity, metadata')
            .eq('stream_id', streamId)
            .eq('sender_id', user.id);

          console.log('[StreamSummary] stream_gifts spent data:', streamGiftsSpent, 'error:', streamGiftsSpentError);

          if (streamGiftsSpent && streamGiftsSpent.length > 0) {
            // Only count trollmonds if user has/had 100+ trollmonds (the deduction threshold)
            // If balance is under 100, they paid full troll coin price with no trollmond deduction
            if (senderTrollmonds >= 100) {
              trollmondsSpent = streamGiftsSpent.reduce((sum: number, g: any) => {
                // Check metadata for actual trollmonds deducted (if recorded)
                const metaDeducted = g.metadata?.trollmonds_deducted;
                if (typeof metaDeducted === 'number' && metaDeducted > 0) {
                  return sum + metaDeducted;
                }
                return sum + (100 * (g.quantity || 1));
              }, 0);
            }
            // If senderTrollmonds < 100, trollmondsSpent stays 0 (they never had enough to trigger deduction)
          }

          // 2. Get gifts received by this user (as receiver)
          // Count the number of gifts received
          const { data: streamGiftsReceived, error: streamGiftsReceivedError } = await supabase
            .from('stream_gifts')
            .select('id, quantity')
            .eq('stream_id', streamId)
            .eq('receiver_id', user.id);

          console.log('[StreamSummary] stream_gifts received data:', streamGiftsReceived, 'error:', streamGiftsReceivedError);

          if (streamGiftsReceived && streamGiftsReceived.length > 0) {
            // Count total number of gifts received (including quantities)
            giftsReceived = streamGiftsReceived.reduce((sum: number, g: any) => {
              return sum + (g.quantity || 1);
            }, 0);
          }
          
          console.log('[StreamSummary] Final user stats:', { trollmondsSpent, giftsReceived });

          // 3. Get new followers gained during this stream
          // Check if user has an artist profile
          const { data: artistProfile } = await supabase
            .from('artist_profiles')
            .select('id')
            .eq('user_id', broadcasterId)
            .maybeSingle();

          if (artistProfile?.id) {
            // Count followers created during the stream
            const { count: followerCount } = await supabase
              .from('artist_followers')
              .select('id', { count: 'exact' })
              .eq('artist_id', artistProfile.id)
              .gte('created_at', streamCreatedAt)
              .lte('created_at', streamEndedAt);

            newFollowers = followerCount || 0;
          }
        }

        setUserStats({
          trollmondsSpent,
          giftsReceived,
          newFollowers
        });
      } catch (err) {
        console.error('Error fetching stream stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStreamStats();
  }, [streamId, user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  const displayStreamStats = streamStats || { 
    title: 'Stream Ended', 
    totalLikes: 0, 
    broadcasterId: '' 
  };

  // Format the stat value for display
  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col items-center p-4 overflow-y-auto">
      <div className="max-w-lg w-full bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-8 flex flex-col items-center text-center shadow-2xl my-auto shrink-0">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4 sm:mb-6 ring-1 ring-yellow-500/50">
          <Trophy size={32} className="text-yellow-500 sm:hidden" />
          <Trophy size={40} className="text-yellow-500 hidden sm:block" />
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Broadcast Ended</h1>
        <p className="text-zinc-400 mb-4 sm:mb-8 text-sm sm:text-base">{displayStreamStats.title || "Great stream! Here's how it went:"}</p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-4 sm:mb-8">
          {/* Trollmonds Spent - What the user spent on this stream */}
          <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex flex-col items-center border border-white/5">
            <Coins className="text-yellow-400 mb-1 sm:mb-2" size={24} />
            <span className="text-2xl sm:text-3xl font-bold text-yellow-400">
              {formatValue(userStats.trollmondsSpent)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mt-1">Trollmonds Spent</span>
          </div>

          {/* Gifts Received - What the user received */}
          <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex flex-col items-center border border-white/5">
            <Gift className="text-pink-400 mb-1 sm:mb-2" size={24} />
            <span className="text-2xl sm:text-3xl font-bold text-pink-400">
              {formatValue(userStats.giftsReceived)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mt-1">Gifts Received</span>
          </div>

          {/* Total Likes - Stream likes */}
          <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex flex-col items-center border border-white/5">
            <Heart className="text-red-400 mb-1 sm:mb-2" size={24} />
            <span className="text-2xl sm:text-3xl font-bold text-red-400">
              {formatValue(displayStreamStats.totalLikes)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mt-1">Total Likes</span>
          </div>

          {/* New Followers - Followers gained during stream */}
          <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex flex-col items-center border border-white/5">
            <UserPlus className="text-green-400 mb-1 sm:mb-2" size={24} />
            <span className="text-2xl sm:text-3xl font-bold text-green-400">
              {formatValue(userStats.newFollowers)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mt-1">New Followers</span>
          </div>
        </div>

        {/* User info */}
        {user && (
          <div className="mb-4 sm:mb-6 p-2 sm:p-3 bg-purple-500/10 rounded-lg border border-purple-500/20 w-full">
            <p className="text-xs sm:text-sm text-purple-300">
              {isBroadcaster 
                ? "You're the broadcaster!"
                : `Watching as: ${profile?.username || 'User'}`
              }
            </p>
          </div>
        )}

        <button 
          onClick={() => navigate('/')}
          className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition flex items-center justify-center gap-2"
        >
          <Home size={20} />
          Back to Home
        </button>
      </div>
    </div>
  );
}
