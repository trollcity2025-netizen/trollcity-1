import { useState, useEffect, useCallback, memo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { X, UserPlus, Shield, Ban, Gift, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface GifterBubble {
  gifter_id: string;
  gifter_username: string;
  gifter_avatar_url: string | null;
  total_coins_sent: number;
}

interface GiftersBubbleStripProps {
  streamId: string;
  hostId: string;
}

function GiftersBubbleStrip({ streamId, hostId }: GiftersBubbleStripProps) {
  const [gifters, setGifters] = useState<GifterBubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGifter, setSelectedGifter] = useState<GifterBubble | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Responsive: 10 on PC, 3 on mobile
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadGifters = useCallback(async () => {
    if (!streamId) return;

    try {
      setLoading(true);
      
      // Get top gifters for this stream from gift_ledger
      // Group by sender and sum amounts
      const { data, error } = await supabase
        .from('gift_ledger')
        .select('sender_id, sender_username, sender_avatar_url, amount')
        .eq('stream_id', streamId)
        .eq('status', 'processed')
        .order('amount', { ascending: false })
        .limit(50); // Get more to sort properly

      if (error) {
        console.error('Error loading gifters:', error);
        return;
      }

      // Group by sender and sum
      const gifterMap = new Map<string, GifterBubble>();
      
      data?.forEach((gift) => {
        const existing = gifterMap.get(gift.sender_id);
        if (existing) {
          existing.total_coins_sent += gift.amount || 0;
        } else {
          gifterMap.set(gift.sender_id, {
            gifter_id: gift.sender_id,
            gifter_username: gift.sender_username || 'Anonymous',
            gifter_avatar_url: gift.sender_avatar_url,
            total_coins_sent: gift.amount || 0,
          });
        }
      });

      // Sort by total amount and take top 20
      const sortedGifters = Array.from(gifterMap.values())
        .sort((a, b) => b.total_coins_sent - a.total_coins_sent)
        .slice(0, 20);

      setGifters(sortedGifters);
    } catch (error: any) {
      console.error('Error loading gifters:', error);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    if (streamId) {
      loadGifters();
      // Refresh every 15 seconds
      const interval = setInterval(loadGifters, 15000);
      return () => clearInterval(interval);
    }
  }, [streamId, loadGifters]);

  // Check follow status when popup opens
  useEffect(() => {
    if (selectedGifter && user) {
      const checkFollow = async () => {
        const { data } = await supabase
          .from('user_follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', selectedGifter.gifter_id)
          .maybeSingle();
        
        setIsFollowing(!!data);
      };
      checkFollow();
    }
  }, [selectedGifter, user]);

  const visibleCount = isMobile ? 3 : 10;
  const visibleGifters = gifters.slice(0, visibleCount);
  const remainingCount = Math.max(0, gifters.length - visibleCount);

  const handleGifterClick = (gifter: GifterBubble) => {
    setSelectedGifter(gifter);
    setShowPopup(true);
  };

  const handleFollow = async () => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }

    if (isFollowing) {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', selectedGifter?.gifter_id);
      
      if (!error) {
        setIsFollowing(false);
        toast.success(`Unfollowed ${selectedGifter?.gifter_username}`);
      }
    } else {
      const { error } = await supabase
        .from('user_follows')
        .insert({ follower_id: user.id, following_id: selectedGifter?.gifter_id });
      
      if (!error) {
        setIsFollowing(true);
        toast.success(`Following ${selectedGifter?.gifter_username}`);
      }
    }
  };

  const handleBlock = async () => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }

    if (confirm(`Block ${selectedGifter?.gifter_username}? You won't see their messages or profile.`)) {
      const { error } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: user.id, blocked_id: selectedGifter?.gifter_id });
      
      if (!error) {
        toast.success(`Blocked ${selectedGifter?.gifter_username}`);
        setShowPopup(false);
      }
    }
  };

  const handleReport = async () => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }

    const reason = prompt('Reason for reporting (spam, harassment, inappropriate, other):');
    if (!reason) return;

    const { error } = await supabase.from('user_reports').insert({
      reporter_id: user.id,
      reported_user_id: selectedGifter?.gifter_id,
      reason,
      stream_id: streamId,
      status: 'pending',
    });

    if (!error) {
      toast.success('Report submitted');
      setShowPopup(false);
    }
  };

  const handleViewProfile = () => {
    if (selectedGifter) {
      navigate(`/profile/${selectedGifter.gifter_id}`);
      setShowPopup(false);
    }
  };

  if (loading && gifters.length === 0) {
    return null; // Don't show anything while loading
  }

  if (gifters.length === 0) {
    return null; // Don't show if no gifters
  }

  return (
    <>
      <div className="w-full px-2 py-2 bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-purple-900/20 border-b border-white/5">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          {/* Gifters bubbles */}
          <div className="flex items-center gap-1.5">
            <Gift size={14} className="text-pink-400 shrink-0 ml-1" />
            
            {visibleGifters.map((gifter, index) => (
              <button
                key={gifter.gifter_id}
                onClick={() => handleGifterClick(gifter)}
                className="relative group flex-shrink-0"
                title={`${gifter.gifter_username}: ${gifter.total_coins_sent.toLocaleString()} coins`}
              >
                <div 
                  className={cn(
                    "relative rounded-full border-2 transition-all duration-200 hover:scale-110 hover:z-10",
                    index === 0 ? "border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.4)]" :
                    index === 1 ? "border-gray-300 shadow-[0_0_8px_rgba(209,213,219,0.3)]" :
                    index === 2 ? "border-amber-600 shadow-[0_0_6px_rgba(217,119,6,0.3)]" :
                    "border-pink-500/50 hover:border-pink-400"
                  )}
                >
                  <img
                    src={gifter.gifter_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(gifter.gifter_username)}&background=random`}
                    alt={gifter.gifter_username}
                    className={cn(
                      "rounded-full object-cover bg-zinc-800",
                      isMobile ? "w-8 h-8" : "w-10 h-10"
                    )}
                  />
                  {/* Rank badge for top 3 */}
                  {index < 3 && (
                    <div className={cn(
                      "absolute -bottom-1 -right-1 rounded-full flex items-center justify-center text-[8px] font-bold",
                      index === 0 ? "bg-yellow-400 text-black" :
                      index === 1 ? "bg-gray-300 text-black" :
                      "bg-amber-600 text-white"
                    )}>
                      {index + 1}
                    </div>
                  )}
                </div>
                
                {/* Amount tooltip */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/90 px-2 py-1 rounded-md text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-pink-500/30">
                  <span className="text-pink-400 font-bold">{gifter.total_coins_sent.toLocaleString()}</span>
                  <span className="text-zinc-400 ml-1">coins</span>
                </div>
              </button>
            ))}
          </div>

          {/* Show more count button (mobile) or overflow count */}
          {remainingCount > 0 && (
            <button
              onClick={() => handleGifterClick(gifters[visibleCount] || gifters[0])}
              className="flex-shrink-0 flex items-center gap-1 bg-zinc-800/80 hover:bg-zinc-700 px-2 py-1 rounded-full border border-pink-500/30 transition-colors"
            >
              <MoreHorizontal size={14} className="text-pink-400" />
              <span className="text-xs font-bold text-pink-400">
                +{remainingCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Mini Profile Popup */}
      {showPopup && selectedGifter && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPopup(false)}
        >
          <div 
            className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with profile */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={selectedGifter.gifter_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedGifter.gifter_username)}&background=random`}
                    alt={selectedGifter.gifter_username}
                    className="w-12 h-12 rounded-full border-2 border-pink-500"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-pink-500 rounded-full p-1">
                    <Gift size={10} className="text-white" />
                  </div>
                </div>
                <div>
                  <div className="font-bold text-white">{selectedGifter.gifter_username}</div>
                  <div className="text-xs text-pink-400 font-bold">
                    {selectedGifter.total_coins_sent.toLocaleString()} coins gifted
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowPopup(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Action buttons */}
            <div className="p-4 space-y-3">
              {/* Follow / View Profile */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleFollow}
                  className={cn(
                    "py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                    isFollowing 
                      ? "bg-green-600 hover:bg-green-500 text-white" 
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  )}
                >
                  <UserPlus size={16} />
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button 
                  onClick={handleViewProfile}
                  className="py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  View Profile
                </button>
              </div>

              {/* Block / Report */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                <button 
                  onClick={handleBlock}
                  className="py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-red-500/20"
                >
                  <Ban size={16} />
                  Block
                </button>
                <button 
                  onClick={handleReport}
                  className="py-2.5 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-yellow-500/20"
                >
                  <Shield size={16} />
                  Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Helper function for conditional classes
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export default memo(GiftersBubbleStrip);
