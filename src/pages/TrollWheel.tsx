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

// Trollmond discount tiers
const TROLLMOND_TIERS = [
  { trollmonds: 0, discount: 0, label: 'No discount' },
  { trollmonds: 100, discount: 5, label: '5% discount' },
  { trollmonds: 200, discount: 10, label: '10% discount' },
  { trollmonds: 300, discount: 15, label: '15% discount' },
  { trollmonds: 400, discount: 20, label: '20% discount' },
  { trollmonds: 500, discount: 25, label: 'MAX 25% discount' },
];

export default function TrollWheel() {
  const { profile } = useAuthStore();
  const { troll_coins: coins, refreshCoins } = useCoins();
  const [userBalance, setUserBalance] = useState(0);
  const [trollmondBalance, setTrollmondBalance] = useState(0);
  const [topSpinners, setTopSpinners] = useState<TopSpinner[]>([]);
  const [bigWinners, setBigWinners] = useState<BigWinner[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Initialize balance from useCoins hook (same as Sidebar)
  useEffect(() => {
    if (coins !== undefined && coins !== null) {
      setUserBalance(coins);
    }
    if (profile?.trollmonds) {
      setTrollmondBalance(profile.trollmonds);
    }
  }, [coins, profile?.trollmonds]);
  
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
              aggregated[spin.user_id].total_winnings += spin.coins_awarded || 0;
              aggregated[spin.user_id].spins += 1;
            });

            const top = Object.values(aggregated)
              .sort((a, b) => b.total_winnings - a.total_winnings)
              .slice(0, 10);
            setTopSpinners(top);

            const winners = spinners
              .filter((s: any) => s.reward_value >= 10)
              .slice(0, 10)
              .map((w: any) => ({
                username: profileMap[w.user_id] || 'Unknown',
                reward_value: w.reward_value,
                coins_awarded: w.coins_awarded,
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

  const handleBalanceChange = (newBalance: number) => {
    setUserBalance(newBalance);
    // Refresh coins from database after spin
    refreshCoins();
  };

  const handleTrollmondChange = async (newBalance: number) => {
    setTrollmondBalance(newBalance);
    // Refresh profile from database to get updated trollmonds
    if (profile?.id) {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('trollmonds')
          .eq('id', profile.id)
          .single();
        if (data?.trollmonds !== undefined) {
          setTrollmondBalance(data.trollmonds);
        }
      } catch (err) {
        console.warn('Failed to refresh trollmonds:', err);
      }
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

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden flex flex-col md:p-8">
      {/* Header - Desktop only */}
      <div className="hidden md:block max-w-7xl mx-auto mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg shadow-yellow-500/20">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Troll Wheel
            </h1>
            <p className="text-slate-400 text-sm">
              Spin to win! 125 coins per spin ($1.25)
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 p-2 md:p-0">
        {/* Main Game Area */}
        <div className="lg:col-span-2 h-full flex flex-col">
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
                  <Coins className="w-5 h-5 text-yellow-400" />
                  <span className="font-bold">{userBalance.toLocaleString()}</span>
                  <span className="text-yellow-400 text-sm">coins</span>
                </div>
                <div className="flex items-center gap-1">
                  <Gem className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-300 text-sm">{trollmondBalance}</span>
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
          <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center">
            <div className="w-full h-full md:h-auto bg-slate-800/50 backdrop-blur-sm rounded-2xl md:rounded-3xl p-2 md:p-6 border border-slate-700">
              <TrollWheelGame 
                userBalance={userBalance}
                trollmondBalance={trollmondBalance}
                onBalanceChange={handleBalanceChange}
                onTrollmondChange={handleTrollmondChange}
              />
            </div>
          </div>
        </div>

        {/* Sidebar - Desktop only */}
        <div className="hidden lg:flex flex-col space-y-4 overflow-y-auto">
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
    </div>
  );
}
