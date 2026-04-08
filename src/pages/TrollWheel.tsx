// TrollWheel.tsx - Main Troll Wheel Page
import React, { useState, useEffect } from 'react';
import TrollWheelGame from '@/components/games/TrollWheelGame';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { toast } from 'sonner';
import { Coins, Trophy, Crown, Gift, Zap, Gem, X, Minus } from 'lucide-react';

interface TopSpinner {
  username: string;
  total_winnings: number;
  spins: number;
}

interface BigWinner {
  username: string;
  reward_value: number;
  coins_awarded: number;
  created_at: string;
}

// Trollmond discount tiers - 10% max discount
const TROLLMOND_TIERS = [
  { trollmonds: 0, discount: 0, label: 'No discount' },
  { trollmonds: 50, discount: 5, label: '5% off gifts' },
  { trollmonds: 100, discount: 10, label: 'MAX 10% off gifts' },
];

export default function TrollWheel() {
  const { profile } = useAuthStore();
  const { refreshCoins } = useCoins();
  const [topSpinners, setTopSpinners] = useState<TopSpinner[]>([]);
  const [bigWinners, setBigWinners] = useState<BigWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [trollmondBalance, setTrollmondBalance] = useState(profile?.trollmonds ?? 0);
  const userBalance = trollmondBalance;
  
  // Sync trollmondBalance when profile changes
  useEffect(() => {
    if (profile?.trollmonds !== undefined) {
      setTrollmondBalance(profile.trollmonds);
    }
  }, [profile?.trollmonds]);
  
  // Mobile: toggle for info bubble
  const [showMobileInfo, setShowMobileInfo] = useState(true);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: spinners } = await supabase
          .from('troll_wheel_wins')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (spinners && spinners.length > 0) {
          // Get unique user IDs
          const userIds = [...new Set(spinners.map((s: any) => s.user_id).filter(Boolean))];
          
          if (userIds.length > 0) {
            // Fetch usernames for these users
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('id, username')
              .in('id', userIds);
            
            const profileMap: Record<string, string> = {};
            profiles?.forEach((p: any) => {
              profileMap[p.id] = p.username;
            });

            const aggregated: Record<string, TopSpinner> = {};
            spinners.forEach((spin: any) => {
              if (!spin.user_id) return;
              if (!aggregated[spin.user_id]) {
                aggregated[spin.user_id] = {
                  username: profileMap[spin.user_id] || 'Unknown',
                  total_winnings: 0,
                  spins: 0,
                };
              }
              aggregated[spin.user_id].total_winnings += spin.reward_amount || 0;
              aggregated[spin.user_id].spins += 1;
            });

            const top = Object.values(aggregated)
              .sort((a, b) => b.total_winnings - a.total_winnings)
              .slice(0, 10);
            setTopSpinners(top);

            const winners = spinners
              .filter((s: any) => s.reward_amount >= 10)
              .slice(0, 10)
              .map((w: any) => ({
                username: profileMap[w.user_id] || 'Unknown',
                reward_value: w.reward_amount,
                coins_awarded: w.reward_amount,
                created_at: w.created_at,
              }));
            setBigWinners(winners);
          }
        }
      } catch (err) {
        console.warn('[TrollWheel] No data yet:', err);
      }
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleBalanceChange = async (newBalance: number) => {
    // Optimistically update local state
    setTrollmondBalance(newBalance);
    // Sync sidebar by updating the global store profile
    if (profile) {
      useAuthStore.getState().setProfile({ ...profile, trollmonds: newBalance });
    }
  };

  const handleTrollmondChange = async (newBalance: number) => {
    // Optimistically update local state
    setTrollmondBalance(newBalance);
    // Sync sidebar by updating the global store profile
    if (profile) {
      useAuthStore.getState().setProfile({ ...profile, trollmonds: newBalance });
    }
  };

  const getDiscountTier = () => {
    for (let i = TROLLMOND_TIERS.length - 1; i >= 0; i--) {
      if (trollmondBalance >= TROLLMOND_TIERS[i].trollmonds) {
        return TROLLMOND_TIERS[i];
      }
    }
    return TROLLMOND_TIERS[0];
  };

  const discountTier = getDiscountTier();

  // Under construction - show only the construction message
  const IS_UNDER_CONSTRUCTION = false;

  if (IS_UNDER_CONSTRUCTION) {
    return (
    <div className="fixed inset-0 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-950 to-slate-950" />
        </div>
        <div className="relative z-10 text-center p-8">
          <div className="text-6xl mb-4">🚧</div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            UNDER CONSTRUCTION
          </h1>
          <p className="text-xl text-yellow-400 mb-2">
            The Troll Wheel is being rebuilt!
          </p>
          <p className="text-gray-400">
            Check back soon for an exciting new experience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden flex flex-col items-center justify-center">
      {/* Header */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-4 md:pt-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 md:p-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg shadow-yellow-500/20">
            <Zap className="w-6 md:w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white">
              Troll Wheel
            </h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Spin to win! 10 Trollmonds per spin
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full px-4 md:px-6 pb-6 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
        {/* Main Game Area - Left Column */}
        <div className="h-full flex flex-col min-h-0">
          {/* Mobile Info Bubble - Integrated compact view */}
          <div className="lg:hidden mb-2">
            <div 
              className={`bg-slate-800/90 backdrop-blur-sm rounded-2xl border border-slate-700 transition-all duration-300 ${
                showMobileInfo ? 'p-3' : 'p-1'
              }`}
            >
              {/* Collapsible Header */}
              <button 
                onClick={() => setShowMobileInfo(!showMobileInfo)}
                className="w-full flex items-center justify-between text-white"
              >
                <div className="flex items-center gap-2">
                  <Gem className="w-5 h-5 text-purple-400" />
                  <span className="font-bold">{trollmondBalance.toLocaleString()}</span>
                  <span className="text-purple-300 text-sm">Trollmonds</span>
                </div>
                <div className="flex items-center gap-1">
                  {showMobileInfo ? <X size={16} /> : <Minus size={16} />}
                </div>
              </button>
              
              {/* Expanded Content */}
              {showMobileInfo && (
                <div className="mt-2 pt-2 border-t border-slate-600 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-1">
                    <Gift className="w-4 h-4 text-pink-400" />
                    <span>Gift Box</span>
                  </div>
                  <div className="text-purple-300">
                    {discountTier.label}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Wheel Game */}
          <div className="flex-1 w-full min-h-0 flex items-center justify-center overflow-hidden">
            <div className="w-full bg-slate-800/50 backdrop-blur-sm rounded-2xl md:rounded-3xl p-3 md:p-6 border border-slate-700 overflow-hidden">
              <TrollWheelGame 
                userBalance={userBalance}
                trollmondBalance={trollmondBalance}
                onBalanceChange={handleBalanceChange}
                onTrollmondChange={handleTrollmondChange}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Stats Panels */}
        <div className="flex flex-col gap-4 overflow-y-auto lg:h-full">
          {/* Trollmond Balance & Discount */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Gem className="w-5 h-5 text-white" />
              <span className="font-bold text-white">Trollmond Balance</span>
            </div>
            <div className="text-center mb-3">
              <span className="text-3xl font-bold text-white">{trollmondBalance.toLocaleString()}</span>
              <span className="text-white/70 ml-2">💎</span>
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
              <span className="text-yellow-300 font-bold">{discountTier.label}</span>
            </div>
            <p className="text-white/60 text-xs mt-2 text-center">
              Earn 1 Trollmond per 100 coins spent on gifts
            </p>
          </div>

          {/* Big Winners Banner */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-white" />
              <span className="font-bold text-white">🏆 Big Winners ($10+)</span>
            </div>
            <div className="space-y-2">
              {loading ? (
                <p className="text-white/70 text-sm">Loading...</p>
              ) : bigWinners.length > 0 ? (
                bigWinners.map((winner, index) => (
                  <div key={index} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      {index === 0 && <Crown className="w-4 h-4 text-yellow-400" />}
                      <span className="text-white text-sm font-medium">{winner.username}</span>
                    </div>
                    <span className="text-yellow-300 font-bold">${winner.reward_value}</span>
                  </div>
                ))
              ) : (
                <p className="text-white/70 text-sm">No big winners yet!</p>
              )}
            </div>
          </div>

          {/* Top Spinners */}
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="font-bold text-white">Top Spinners</span>
            </div>
            <div className="space-y-2">
              {loading ? (
                <p className="text-slate-400 text-sm">Loading...</p>
              ) : topSpinners.length > 0 ? (
                topSpinners.map((spinner, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 w-6 text-sm">#{index + 1}</span>
                      <span className="text-white text-sm font-medium">{spinner.username}</span>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Coins className="w-3 h-3" />
                      <span className="text-sm font-bold">{spinner.total_winnings.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm">No spins yet!</p>
              )}
            </div>
          </div>


        </div>
      </div>

      {/* Floating Menu Button - Fixed Position */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => window.location.reload()}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-full shadow-lg shadow-purple-500/30 hover:scale-110 transition-transform"
          title="Refresh Wheel"
        >
          <Zap className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
