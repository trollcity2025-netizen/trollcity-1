import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Heart, Share2, Users, Coins, Zap, Crown, Shield, Ban, Eye, MicOff, MessageSquare, Gift, Video } from 'lucide-react';
import { toast } from 'sonner';

interface StreamData {
  id: string;
  title: string;
  broadcaster_id: string;
  pricing_type: string;
  pricing_value: number;
  gift_multiplier: string;
  like_price: number | string;
  family_xp_bonus: boolean;
  family_coin_bonus: boolean;
  notify_followers: boolean;
  notify_family: boolean;
  allow_officer_free_join: boolean;
  moderator_mode: boolean;
  allow_gifts: boolean;
  max_guest_slots: number;
  viewer_count: number;
  total_gifts_coins: number;
}

interface UserProfile {
  id: string;
  username: string;
  level: number;
  role: string;
  troll_family_id?: string;
}

const LiveBroadcast: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const { user, profile } = useAuthStore();

  const [stream, setStream] = useState<StreamData | null>(null);
  const [broadcaster, setBroadcaster] = useState<UserProfile | null>(null);
  const [viewers, setViewers] = useState<UserProfile[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [hasPaidEntry, setHasPaidEntry] = useState(false);
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);

  // Award XP for gifts if family bonus enabled
  const awardGiftXP = async (giftAmount: number) => {
    if (!stream?.family_xp_bonus || !profile) return;

    const xpGain = Math.floor(giftAmount / 10); // 1 XP per 10 coins gifted
    await supabase
      .from('user_profiles')
      .update({ xp: (profile.xp || 0) + xpGain })
      .eq('id', profile.id);
  };

  // Load stream data
  useEffect(() => {
    const loadStream = async () => {
      if (!streamId) return;

      const { data } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .single();

      if (data) {
        setStream(data);

        // Load broadcaster profile
        const { data: broadcasterData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.broadcaster_id)
          .single();

        setBroadcaster(broadcasterData);

        // Trigger notifications if enabled
        if (data.notify_followers || data.notify_family) {
          triggerNotifications(data);
        }
      }
    };

    loadStream();
  }, [streamId]);

  const triggerNotifications = async (streamData: any) => {
    if (!broadcaster) return;

    const notifications = [];

    if (streamData.notify_followers) {
      // Get followers
      const { data: followers } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', broadcaster.id);

      followers?.forEach(follower => {
        notifications.push({
          user_id: follower.follower_id,
          type: 'stream_started',
          title: 'Stream Started',
          message: `${broadcaster.username} is now live!`,
          data: { stream_id: streamData.id },
          created_at: new Date().toISOString()
        });
      });
    }

    if (streamData.notify_family) {
      // Get family members (placeholder - need family relationship table)
      // For now, skip family notifications
    }

    if (notifications.length > 0) {
      await supabase
        .from('notifications')
        .insert(notifications);
    }
  };

  // Family XP Integration
  useEffect(() => {
    if (!stream?.family_xp_bonus || !user || !profile) return;

    const interval = setInterval(async () => {
      // Award XP per minute for family members (placeholder - need family check)
      const xpGain = 1; // 1 XP per minute
      await supabase
        .from('user_profiles')
        .update({ xp: (profile.xp || 0) + xpGain })
        .eq('id', profile.id);
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [stream, user, profile, broadcaster]);

  // Paid entry logic
  useEffect(() => {
    const checkPaidEntry = async () => {
      if (!user || !stream) return;

      if (stream.pricing_type === 'free') {
        setHasPaidEntry(true);
        return;
      }

      // Check if user has paid
      const { data } = await supabase
        .from('stream_entries')
        .select('has_paid_entry')
        .eq('stream_id', stream.id)
        .eq('user_id', user.id)
        .single();

      if (data?.has_paid_entry) {
        setHasPaidEntry(true);
      } else {
        // Deduct coins and mark as paid
        const cost = stream.pricing_type.startsWith('per_minute_')
          ? stream.pricing_value
          : 0; // For now, assume entry fee

        const totalCoins = (profile?.paid_coin_balance || 0) + (profile?.free_coin_balance || 0);
        if (profile && totalCoins >= cost) {
          const newPaidBalance = Math.max(0, (profile.paid_coin_balance || 0) - cost);
          const remainingCost = cost - (profile.paid_coin_balance || 0);
          const newFreeBalance = remainingCost > 0 ? Math.max(0, (profile.free_coin_balance || 0) - remainingCost) : (profile.free_coin_balance || 0);

          await supabase
            .from('user_profiles')
            .update({
              paid_coin_balance: newPaidBalance,
              free_coin_balance: newFreeBalance
            })
            .eq('id', profile.id);

          await supabase
            .from('stream_entries')
            .upsert({
              stream_id: stream.id,
              user_id: user.id,
              has_paid_entry: true,
              entry_time: new Date().toISOString()
            });

          setHasPaidEntry(true);
          toast.success(`Paid ${cost} coins to enter stream`);
        } else {
          toast.error('Insufficient coins to enter stream');
        }
      }
    };

    if (stream) checkPaidEntry();
  }, [stream, user, profile]);

  if (!stream || !hasPaidEntry) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p>Loading stream...</p>
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin' || profile?.is_lead_officer || profile?.role === 'troll_officer' || profile?.is_admin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      {/* HUD Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-purple-500/20 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {broadcaster?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="font-semibold">{broadcaster?.username}</div>
                <div className="text-xs text-gray-400">Level {broadcaster?.level}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold">{stream.total_gifts_coins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">0</span> {/* Trollmonds */}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-400" />
              <span className="font-semibold">{stream.viewer_count}</span>
            </div>
            <button
              onClick={() => setLikeCount(prev => prev + 1)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
            >
              <Heart className="w-5 h-5 text-red-400" />
              <span className="font-semibold">{likeCount}</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors">
              <Share2 className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Share</span>
            </button>
          </div>
        </div>
      </div>

      <div className="pt-20 pb-20 flex h-screen">
        {/* Video Layout */}
        <div className="flex-1 p-4">
          <div className="bg-zinc-900/50 border border-purple-500/20 rounded-xl h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-400">LiveKit Video Grid</p>
              <p className="text-sm text-gray-500">1-6 participant boxes with auto-resizing</p>
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="w-80 bg-zinc-900/50 border-l border-purple-500/20 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <span className="font-semibold">Chat</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {/* Chat messages would go here */}
            <div className="text-gray-400 text-sm">Chat messages...</div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <input
              type="text"
              placeholder="Type a message..."
              className="w-full bg-zinc-800 border border-purple-500/30 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Gift Box Drawer */}
      {showGiftDrawer && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-sm border-t border-purple-500/20 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-400" />
                Send Gifts
              </h3>
              <button
                onClick={() => setShowGiftDrawer(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {/* Gift items would go here */}
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <div className="text-sm font-semibold">Gift Name</div>
                <div className="text-xs text-gray-400">100 coins</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin/Officer Tools */}
      {isAdmin && (
        <div className="fixed bottom-4 right-4 bg-zinc-900/90 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4">
          <div className="space-y-2">
            <button className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded text-sm flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Ban User
            </button>
            <button className="w-full px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 rounded text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Shadow Ban
            </button>
            <button className="w-full px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 rounded text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Kick
            </button>
            <button className="w-full px-3 py-2 bg-gray-500/20 hover:bg-gray-500/30 rounded text-sm flex items-center gap-2">
              <MicOff className="w-4 h-4" />
              Mute
            </button>
            <button className="w-full px-3 py-2 bg-pink-500/20 hover:bg-pink-500/30 rounded text-sm flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Gift Freeze
            </button>
            <button className="w-full px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat Purge
            </button>
            <button className="w-full px-3 py-2 bg-red-600/20 hover:bg-red-600/30 rounded text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Disable Stream
            </button>
            <button className="w-full px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded text-sm flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Court Summon
            </button>
            <button className="w-full px-3 py-2 bg-green-500/20 hover:bg-green-500/30 rounded text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Evidence Capture
            </button>
          </div>
        </div>
      )}

      {/* Gift Button */}
      <button
        onClick={() => setShowGiftDrawer(!showGiftDrawer)}
        className="fixed bottom-4 left-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
      >
        <Gift className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};

export default LiveBroadcast;