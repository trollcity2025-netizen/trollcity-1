import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, Award, Coins, AlertCircle, CheckCircle, X, ArrowRight, Loader2, Clock } from 'lucide-react';
import { cashoutTiers, getEligibleTier, calculateTotalCoins, formatCoins, formatUSD } from '../lib/coinMath';
import RequireRole from '../components/RequireRole';

export default function EarningsPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [earningsData, setEarningsData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || !profile) {
      navigate('/auth', { replace: true });
      return;
    }

    // Check if user has broadcaster or admin role
    const allowedRoles = ['broadcaster', 'admin'];
    if (!allowedRoles.includes(profile.role)) {
      navigate('/live', { replace: true });
      return;
    }

    loadEarningsData();
  }, [user, profile, navigate]);

  const loadEarningsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load user profile data with coin balances
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance, free_coin_balance, total_earned_coins, role, username')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Load payout history
      const { data: payoutHistory, error: payoutError } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setEarningsData({
        ...profileData,
        payoutHistory: payoutHistory || [],
        totalCoins: calculateTotalCoins(profileData.paid_coin_balance, profileData.free_coin_balance)
      });

    } catch (err) {
      console.error('Error loading earnings data:', err);
      setError('Failed to load earnings data. Please try again.');
      toast.error('Failed to load earnings data');
    } finally {
      setLoading(false);
    }
  };

  const handleCashoutRequest = async (tier) => {
    if (!tier || processing) return;

    try {
      setProcessing(true);

      // Validate that user has enough coins
      const totalCoins = calculateTotalCoins(profile.paid_coin_balance, profile.free_coin_balance);
      if (totalCoins < tier.coins) {
        toast.error(`You need at least ${formatCoins(tier.coins)} coins for this tier`);
        return;
      }

      // Insert payout request into Supabase
      const { data, error } = await supabase.from('payout_requests').insert({
        user_id: user.id,
        requested_coins: tier.coins,
        amount_usd: tier.payout,
        status: 'pending'
      });

      if (error) {
        throw error;
      }

      // Refresh earnings data
      await loadEarningsData();

      toast.success(`Cashout request submitted! ${formatCoins(tier.coins)} coins = ${formatUSD(tier.payout)}`);
    } catch (err) {
      console.error('Cashout error:', err);
      toast.error(err.message || 'Failed to submit cashout request');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-purple-400" />
              Earnings Dashboard
            </h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/3 mt-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-400 mb-2">Error Loading Earnings</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={loadEarningsData}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto"
          >
            <ArrowRight className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!earningsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto bg-zinc-900 border border-gray-700 rounded-xl p-8 text-center">
          <Coins className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Earnings Data</h2>
          <p className="text-gray-400 mb-6">Start earning coins by streaming and receiving gifts!</p>
          <button
            onClick={() => navigate('/go-live')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Start Streaming
          </button>
        </div>
      </div>
    );
  }

  const totalCoins = earningsData.totalCoins;
  const eligibleTier = getEligibleTier(totalCoins);
  const allEligibleTiers = cashoutTiers.filter(tier => totalCoins >= tier.coins);

  return (
    <RequireRole roles={['broadcaster', 'admin']} fallbackPath="/dashboard">
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-purple-400" />
              Earnings Dashboard
            </h1>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Coins */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-gray-400">Total Coins</span>
              </div>
              <p className="text-3xl font-bold text-purple-400">
                {formatCoins(totalCoins)}
              </p>
              <p className="text-xs text-gray-500 mt-1">paid + free coins combined</p>
            </div>

            {/* Paid Coins */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-yellow-500/30 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-gray-400">Troll Coins</span>
              </div>
              <p className="text-3xl font-bold text-yellow-400">
                {formatCoins(earningsData.paid_coin_balance || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">withdrawable balance</p>
            </div>

            {/* Free Coins */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-green-500/30 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">Trollmonds</span>
              </div>
              <p className="text-3xl font-bold text-green-400">
                {formatCoins(earningsData.free_coin_balance || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">earned from activities</p>
            </div>
          </div>

          {/* Cashout Tiers Section */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-400" />
              Cashout Tiers
            </h2>

            {/* Current Eligible Tier Highlight */}
            {eligibleTier && (
              <div className="mb-6 bg-gradient-to-r from-purple-900/30 to-purple-800/30 rounded-lg p-4 border border-purple-500 shadow-lg shadow-purple-500/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-purple-300">
                        {eligibleTier.name} Tier Eligible!
                      </p>
                      <p className="text-sm text-gray-300">
                        {formatCoins(eligibleTier.coins)} coins = {formatUSD(eligibleTier.payout)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCashoutRequest(eligibleTier)}
                    disabled={processing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Request Cashout
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* All Tiers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {cashoutTiers.map((tier) => {
                const isEligible = totalCoins >= tier.coins;
                const isCurrentEligible = eligibleTier?.id === tier.id;

                return (
                  <div
                    key={tier.id}
                    className={`rounded-xl p-4 border transition-all ${
                      isCurrentEligible
                        ? 'border-purple-500 shadow-lg shadow-purple-500/50 bg-gradient-to-br from-purple-900/20 to-purple-800/20'
                        : isEligible
                        ? 'border-gray-600 bg-zinc-800/50'
                        : 'border-gray-700 bg-zinc-900/50 opacity-60'
                    }`}
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold ${
                          isCurrentEligible ? 'text-purple-300' : isEligible ? 'text-white' : 'text-gray-400'
                        }`}>
                          {tier.name}
                        </span>
                        {isCurrentEligible && (
                          <span className="text-xs px-2 py-0.5 bg-purple-600 rounded-full">Eligible</span>
                        )}
                        {isEligible && !isCurrentEligible && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        {formatCoins(tier.coins)} coins
                      </p>
                    </div>

                    <div className="mb-3">
                      <p className="text-lg font-bold text-green-400">
                        {formatUSD(tier.payout)}
                      </p>
                      <p className="text-xs text-gray-500">payout amount</p>
                    </div>

                    {!isEligible ? (
                      <div className="text-xs text-gray-500 mt-2">
                        <p>Need {formatCoins(tier.coins - totalCoins)} more coins</p>
                        <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                          <div
                            className="h-1 rounded-full bg-purple-500"
                            style={{ width: `${Math.min(100, (totalCoins / tier.coins) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : !isCurrentEligible ? (
                      <button
                        onClick={() => handleCashoutRequest(tier)}
                        disabled={processing}
                        className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      >
                        Request {formatUSD(tier.payout)}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payout History */}
          {earningsData.payoutHistory && earningsData.payoutHistory.length > 0 && (
            <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Recent Payouts
              </h2>
              <div className="space-y-3">
                {earningsData.payoutHistory.map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        payout.status === 'paid' ? 'bg-green-400' :
                        payout.status === 'pending' ? 'bg-yellow-400' :
                        payout.status === 'rejected' ? 'bg-red-400' : 'bg-gray-400'
                      }`} />
                      <div>
                        <p className="font-semibold">
                          {formatUSD(payout.amount_usd)} • {formatCoins(payout.requested_coins)} coins
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(payout.created_at).toLocaleDateString()} • {payout.status}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      payout.status === 'paid' ? 'bg-green-900/50 text-green-300' :
                      payout.status === 'pending' ? 'bg-yellow-900/50 text-yellow-300' :
                      payout.status === 'rejected' ? 'bg-red-900/50 text-red-300' : 'bg-gray-700 text-gray-300'
                    }`}>
                      {payout.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Payouts Message */}
          {earningsData.payoutHistory && earningsData.payoutHistory.length === 0 && (
            <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] text-center">
              <Coins className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payouts Yet</h3>
              <p className="text-gray-400">
                Your cashout requests will appear here once submitted
              </p>
            </div>
          )}
        </div>
      </div>
    </RequireRole>
  );
}