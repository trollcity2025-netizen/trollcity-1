import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dices, TrendingUp, TrendingDown, Award, Clock, AlertCircle } from "lucide-react";
import { debitCoins, creditCoins, debitPurchasedCoinsWithNegative } from "@/lib/coins";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const GamblePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [betAmount, setBetAmount] = useState("");
  const [gameResult, setGameResult] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [stats, setStats] = useState({ wins: 0, losses: 0, totalWon: 0, totalLost: 0 });
  const [dailyPlays, setDailyPlays] = useState(0);
  const [lastPlayDate, setLastPlayDate] = useState(null);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user || null;
    },
    retry: false,
    staleTime: 5000,
  });

  // Get user profile with coin info
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["userProfile", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, coins, free_coins, purchased_coins, username")
        .eq("id", currentUser.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
    refetchInterval: 3000,
  });

  // Fetch gambling history
  const { data: gamblingHistory = [] } = useQuery({
    queryKey: ["gamblingHistory", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await supabase
        .from("gambling_records")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.id,
    refetchInterval: 5000,
  });

  // Fetch overall gambling stats
  const { data: houseStats = {} } = useQuery({
    queryKey: ["houseGamblingStats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gambling_stats")
        .select("*")
        .single();
      if (error) {
        console.warn("No house stats yet");
        return { total_wagered: 0, total_paid_out: 0, total_house_profit: 0 };
      }
      return data;
    },
    refetchInterval: 10000,
  });

  // Calculate local stats from history
  useEffect(() => {
    if (gamblingHistory.length > 0) {
      const wins = gamblingHistory.filter(g => g.result === "win").length;
      const losses = gamblingHistory.filter(g => g.result === "loss").length;
      const totalWon = gamblingHistory
        .filter(g => g.result === "win")
        .reduce((sum, g) => sum + (g.winnings || 0), 0);
      const totalLost = gamblingHistory
        .filter(g => g.result === "loss")
        .reduce((sum, g) => sum + (g.bet_amount || 0), 0);
      setStats({ wins, losses, totalWon, totalLost });
    }
  }, [gamblingHistory]);

  // Gamble mutation
  const gambleMutation = useMutation({
    mutationFn: async ({ userId, bet }) => {
      if (!userId) throw new Error("User not found");
      if (bet <= 0) throw new Error("Bet amount must be greater than 0");
      if (!profile) throw new Error("Profile not loaded");

      // Try to debit using the new negative coin system first
      let debitResult;
      try {
        debitResult = await debitPurchasedCoinsWithNegative(userId, bet, { 
          reason: "gamble_bet",
          source: "gambling_house",
          reference: "gamble_game"
        });
        
        // Check if user needs to be redirected to store
        if (debitResult.needsStoreRedirect) {
          toast.error("Insufficient coins. Redirecting to store...");
          setTimeout(() => navigate('/store'), 2000);
          setIsSpinning(false);
          return;
        }
      } catch (debitError) {
        // Fallback to strict checking for gambling
        if ((profile.purchased_coins || 0) < bet) {
          throw new Error("Insufficient paid coins. Only paid coins can be used for gambling.");
        }
        
        // Use regular debitCoins as fallback
        await debitCoins(userId, bet, { 
          reason: "gamble_bet",
          source: "gambling_house" 
        });
      }

      // Check daily play limit
      const today = new Date().toDateString();
      const userLastPlayDate = lastPlayDate ? new Date(lastPlayDate).toDateString() : null;
      
      if (userLastPlayDate === today) {
        if (dailyPlays >= 5) {
          throw new Error("Daily limit reached! You can only play 5 times per day.");
        }
      } else {
        // Reset daily plays for new day
        setDailyPlays(0);
        setLastPlayDate(new Date().toISOString());
      }

      // 60% win chance as requested
      const winChance = 0.60;
      const didWin = Math.random() < winChance;
      
      // Progressive multipliers: higher bets = higher wins
      let multiplier = 1.5; // Base multiplier for small bets
      
      if (bet >= 1000) {
        multiplier = 3.0; // High roller bonus
      } else if (bet >= 500) {
        multiplier = 2.5; // Big bet bonus
      } else if (bet >= 100) {
        multiplier = 2.0; // Medium bet bonus
      } else if (bet >= 50) {
        multiplier = 1.8; // Small bet bonus
      }
      
      const winnings = didWin ? Math.floor(bet * multiplier) : 0;

      // Record the bet
      const { error: recordErr } = await supabase.from("gambling_records").insert({
        user_id: userId,
        bet_amount: bet,
        result: didWin ? "win" : "loss",
        winnings: winnings,
        multiplier: didWin ? multiplier : 0,
        created_date: new Date().toISOString(),
      });
      if (recordErr) throw recordErr;

      // If won, credit the winnings (as purchased/paid coins)
      if (didWin) {
        await creditCoins(userId, winnings, {
          reason: "gamble_win",
          source: "gambling_house",
        });
      }

      // Update house stats
      const { data: currentStats } = await supabase
        .from("gambling_stats")
        .select("*")
        .single();

      const statsRow = currentStats || {
        id: "1",
        total_wagered: 0,
        total_paid_out: 0,
        total_house_profit: 0,
      };

      const newStats = {
        ...statsRow,
        total_wagered: (statsRow.total_wagered || 0) + bet,
        total_paid_out: (statsRow.total_paid_out || 0) + winnings,
        total_house_profit: (statsRow.total_wagered || 0) + bet - ((statsRow.total_paid_out || 0) + winnings),
      };

      if (currentStats?.id) {
        await supabase.from("gambling_stats").update(newStats).eq("id", currentStats.id);
      } else {
        await supabase.from("gambling_stats").insert(newStats);
      }

      return { didWin, winnings, bet, multiplier };
    },
    onSuccess: (result) => {
      setGameResult(result);
      setBetAmount("");
      if (result.didWin) {
        toast.success(`🎉 You won ${result.winnings} coins! (${result.multiplier}x multiplier)`);
      } else {
        toast.error(`😢 You lost this round. Better luck next time!`);
      }
      // Refresh user profile and history
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: ["gamblingHistory"] });
      queryClient.invalidateQueries({ queryKey: ["houseGamblingStats"] });
    },
    onError: (error) => {
      toast.error(error.message || "Gambling failed");
    },
  });

  const handleSpin = () => {
    const amount = parseInt(betAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid bet amount");
      return;
    }
    if (!currentUser?.id) {
      toast.error("Please log in first");
      return;
    }

    // Check daily play limit before spinning
    const today = new Date().toDateString();
    const userLastPlayDate = lastPlayDate ? new Date(lastPlayDate).toDateString() : null;
    const currentDailyPlays = userLastPlayDate === today ? dailyPlays : 0;
    
    if (currentDailyPlays >= 5) {
      toast.error("Daily limit reached! You can only play 5 times per day.");
      return;
    }

    setIsSpinning(true);
    setGameResult(null);
    setTimeout(() => {
      gambleMutation.mutate({ userId: currentUser.id, bet: amount });
      setIsSpinning(false);
    }, 2000);
  };

  const handleQuickBet = (amount) => {
    setBetAmount(amount.toString());
  };

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-400">Loading your profile...</p>
      </div>
    );
  }

  const winRate = stats.wins + stats.losses > 0 
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a0a2e] to-[#16213e] p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Dices className="w-8 h-8 text-purple-500" />
          <h1 className="text-4xl font-bold text-white">Troll Casino</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <p className="text-gray-400">60% chance to win! Higher bets = higher multipliers!</p>
          <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 font-semibold">
              Daily Plays: {dailyPlays}/5
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Left: Gambling Interface */}
        <div className="space-y-6">
          {/* User Balance Card */}
          <Card className="bg-[#1a1a2e] border-purple-500/30 p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">Your Balance</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-500/10 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Paid Coins</p>
                  <p className="text-3xl font-bold text-purple-400">
                    {profile?.purchased_coins || 0}
                  </p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Free Coins</p>
                  <p className="text-3xl font-bold text-blue-400">
                    {profile?.free_coins || 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Betting Interface */}
          <Card className="bg-[#1a1a2e] border-purple-500/30 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Place Your Bet</h2>
            
            {/* Daily Limit Warning */}
            {dailyPlays >= 4 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-semibold">
                  Warning: You have {5 - dailyPlays} play{5 - dailyPlays === 1 ? '' : 's'} left today!
                </span>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Bet Amount (Paid Coins Only)</label>
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="Enter bet amount"
                  disabled={isSpinning}
                  className="bg-[#0f0f1a] border-purple-500/30 text-white"
                />
              </div>

              {/* Quick Bet Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[10, 50, 100, 500].map(amount => (
                  <Button
                    key={amount}
                    onClick={() => handleQuickBet(amount)}
                    disabled={isSpinning || (profile?.purchased_coins || 0) < amount}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    {amount}
                  </Button>
                ))}
              </div>

              {/* Spin Button */}
              <Button
                onClick={handleSpin}
                disabled={isSpinning || !betAmount || gambleMutation.isPending}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6 text-lg"
              >
                {isSpinning ? "🎲 SPINNING..." : "🎲 SPIN"}
              </Button>

              {/* Game Result */}
              {gameResult && (
                <div className={`p-4 rounded-lg text-center ${gameResult.didWin ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  <p className="text-2xl font-bold mb-2">
                    {gameResult.didWin ? "🎉 YOU WON!" : "💀 YOU LOST"}
                  </p>
                  <p className="text-gray-300">
                    Bet: {gameResult.bet} coins
                    {gameResult.didWin && ` → Won: ${gameResult.winnings} coins`}
                  </p>
                </div>
              )}

              {/* Rules */}
              <div className="bg-blue-500/10 rounded-lg p-4 text-sm text-gray-300 space-y-2">
                <p>📋 <strong>Rules:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Only paid coins can be used for gambling</li>
                  <li>60% chance to win (high win rate!)</li>
                  <li>Higher bets = higher multipliers (1.5x to 3x)</li>
                  <li>Lost bets go to the house</li>
                  <li>Maximum 5 plays per day</li>
                  <li>Winnings credited instantly</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Statistics */}
        <div className="space-y-6">
          {/* User Stats */}
          <Card className="bg-[#1a1a2e] border-purple-500/30 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Your Stats</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-[#0f0f1a] rounded-lg">
                <span className="text-gray-400">Total Bets:</span>
                <span className="text-white font-bold">{stats.wins + stats.losses}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg">
                <span className="text-gray-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" /> Wins:
                </span>
                <span className="text-green-400 font-bold">{stats.wins}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
                <span className="text-gray-400 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" /> Losses:
                </span>
                <span className="text-red-400 font-bold">{stats.losses}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg">
                <span className="text-gray-400">Win Rate:</span>
                <span className="text-blue-400 font-bold">{winRate}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-500/10 rounded-lg">
                <span className="text-gray-400">Total Won:</span>
                <span className="text-purple-400 font-bold">{stats.totalWon}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
                <span className="text-gray-400">Total Lost:</span>
                <span className="text-red-400 font-bold">{stats.totalLost}</span>
              </div>
            </div>
          </Card>

          {/* House Stats */}
          <Card className="bg-[#1a1a2e] border-yellow-500/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-bold text-white">House Stats</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 bg-[#0f0f1a] rounded-lg">
                <span className="text-gray-400">Total Wagered:</span>
                <span className="text-white font-bold">{houseStats?.total_wagered || 0}</span>
              </div>
              <div className="flex justify-between p-3 bg-[#0f0f1a] rounded-lg">
                <span className="text-gray-400">Total Paid Out:</span>
                <span className="text-white font-bold">{houseStats?.total_paid_out || 0}</span>
              </div>
              <div className="flex justify-between p-3 bg-green-500/10 rounded-lg">
                <span className="text-gray-400">House Profit:</span>
                <span className="text-green-400 font-bold">{houseStats?.total_house_profit || 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Bets */}
      <div className="max-w-6xl mx-auto mt-8">
        <Card className="bg-[#1a1a2e] border-purple-500/30 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Bets</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-purple-500/30">
                <tr>
                  <th className="text-left text-gray-400 py-3 px-4">Date</th>
                  <th className="text-left text-gray-400 py-3 px-4">Bet</th>
                  <th className="text-left text-gray-400 py-3 px-4">Result</th>
                  <th className="text-left text-gray-400 py-3 px-4">Winnings</th>
                </tr>
              </thead>
              <tbody>
                {gamblingHistory.slice(0, 10).map((bet, idx) => (
                  <tr key={idx} className="border-b border-[#0f0f1a] hover:bg-[#0f0f1a]/50">
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(bet.created_date).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-white">{bet.bet_amount}</td>
                    <td className="py-3 px-4">
                      <Badge className={bet.result === "win" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                        {bet.result.toUpperCase()}
                      </Badge>
                    </td>
                    <td className={`py-3 px-4 font-bold ${bet.result === "win" ? "text-green-400" : "text-red-400"}`}>
                      {bet.winnings > 0 ? `+${bet.winnings}` : `-${bet.bet_amount}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GamblePage;
