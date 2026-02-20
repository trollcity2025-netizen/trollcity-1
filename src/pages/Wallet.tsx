import React, { useEffect, useState, useCallback } from "react";

import { useAuthStore } from "../lib/store";
import { useNavigate } from "react-router-dom";
import { Wallet as WalletIcon, Coins, DollarSign, RefreshCw, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { getTransactionHistory, logCoinAction } from "../lib/coinUtils";
import { supabase } from "../lib/supabase";
import { format12hr } from "../utils/timeFormat";
import { toast } from "sonner";
import { TIERS } from "../lib/payoutTiers";

interface CoinTx {
  id: string;
  coins: number;
  usd_amount: string | number;
  source: string;
  external_id: string | null;
  payment_status: string | null;
  created_at: string;
  type: string;
  description?: string;
}

export default function Wallet() {
  const { user, profile } = useAuthStore();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const navigate = useNavigate();
  const [txs, setTxs] = useState<CoinTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceStats, setBalanceStats] = useState({
    totalEarned: 0,
    totalSpent: 0,
    netChange: 0
  });

  const loadWalletData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Load transactions with enhanced data
      const { transactions, error: txError } = await getTransactionHistory(user.id, {
        limit: 50
      });

      if (txError) {
        throw new Error(txError);
      }

      setTxs(transactions);

      // Calculate balance statistics
      const totalEarned = transactions
        .filter(tx => tx.coins > 0)
        .reduce((sum, tx) => sum + tx.coins, 0);
      
      const totalSpent = transactions
        .filter(tx => tx.coins < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.coins), 0);

      setBalanceStats({
        totalEarned,
        totalSpent,
        netChange: totalEarned - totalSpent
      });

      // Log wallet view for audit
      await logCoinAction(user.id, 'wallet_viewed', {
        timestamp: new Date().toISOString(),
        transactionCount: transactions.length
      }, supabase);

    } catch (err: any) {
      console.error('Wallet loading error:', err);
      setError(err.message || 'Failed to load wallet data');
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleRefresh = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      // Refresh both profile and transactions
      await Promise.all([
        refreshProfile(),
        loadWalletData()
      ]);
      toast.success('Wallet refreshed');
    } catch {
      toast.error('Failed to refresh wallet');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  if (!user) {
    return (
      <div className="p-6 text-center text-white min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Please log in to view your wallet.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-white min-h-screen">
        <div className="flex items-center gap-3 mb-6">
          <WalletIcon className="w-8 h-8 text-red-400" />
          <h1 className="text-3xl font-bold">Wallet</h1>
        </div>
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Wallet</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto text-white min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <WalletIcon className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">Wallet</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Enhanced Balance Overview */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl bg-black/60 border border-purple-600 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-purple-400" />
            <div className="text-sm opacity-70">Available Coins</div>
          </div>
          <div className="text-2xl font-bold text-purple-300">
            {Math.max(0, (profile?.troll_coins || 0) - (profile?.reserved_troll_coins || 0)).toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {profile?.reserved_troll_coins ? `${profile.reserved_troll_coins.toLocaleString()} reserved` : 'Withdrawable balance'}
          </div>
        </div>

        <div className="rounded-xl bg-black/60 border border-green-600 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-green-400" />
            <div className="text-sm opacity-70">Free Coins</div>
          </div>
          <div className="text-2xl font-bold text-green-300">
            {Number(profile?.troll_coins || 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Entertainment & bonuses
          </div>
        </div>

        <div className="rounded-xl bg-black/60 border border-yellow-600 p-4">
          <div className="flex items-center gap-2 mb-2">
            {balanceStats.netChange >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
            <div className="text-sm opacity-70">Net Change</div>
          </div>
          <div className={`text-2xl font-bold ${balanceStats.netChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {balanceStats.netChange >= 0 ? '+' : ''}{balanceStats.netChange.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Lifetime earnings
          </div>
        </div>

        <div className="rounded-xl bg-black/60 border border-blue-600 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <div className="text-sm opacity-70">Payout Method</div>
          </div>
          <div className="text-sm mt-1">
            {profile?.payout_paypal_email ? (
              <>
                <div className="font-mono text-xs text-green-300">Payout Email Connected</div>
                <div className="text-xs text-gray-400 mt-1">
                  {profile.payout_paypal_email.substring(0, 20)}...
                </div>
              </>
            ) : (
              <span className="text-red-400 text-sm">Not set</span>
            )}
          </div>
          {!profile?.payout_paypal_email && (
            <button
              onClick={() => navigate("/payouts/setup")}
              className="mt-2 text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Set Up Payouts
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl bg-black/40 border border-gray-600 p-4">
          <h3 className="text-lg font-semibold mb-3">Earnings Overview</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Earned:</span>
              <span className="text-green-400 font-semibold">
                {Number(balanceStats.totalEarned || 0).toLocaleString()} coins
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Spent:</span>
              <span className="text-red-400 font-semibold">
                {Number(balanceStats.totalSpent || 0).toLocaleString()} coins
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-600 pt-2">
              <span className="text-gray-400">Current Net:</span>
              <span className={`font-bold ${balanceStats.netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {balanceStats.netChange >= 0 ? '+' : ''}{Number(balanceStats.netChange || 0).toLocaleString()} coins
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-black/40 border border-gray-600 p-4">
          <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => navigate("/store")}
              className="w-full text-left px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg border border-purple-500/30 transition-colors"
            >
              <div className="font-semibold">Buy Coins</div>
              <div className="text-xs text-gray-400">Purchase more coins</div>
            </button>
            <button
              onClick={() => navigate("/transactions")}
              className="w-full text-left px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg border border-blue-500/30 transition-colors"
            >
              <div className="font-semibold">Transaction History</div>
              <div className="text-xs text-gray-400">View detailed history</div>
            </button>
          </div>
        </div>
      </div>

      {/* Cashout Tiers */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Cashout Tiers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {TIERS.map((tier) => (
            <div key={tier.coins} className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-4 flex flex-col items-center text-center hover:border-purple-500 transition-colors">
              <div className="text-2xl font-bold text-white mb-1">
                ${tier.usd}
              </div>
              <div className="text-sm text-purple-400 font-medium mb-2">
                {tier.coins.toLocaleString()} coins
              </div>
              {tier.manualReview && (
                <div className="text-[10px] uppercase tracking-wider font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                  Manual Review
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Enhanced Transaction History */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/transactions")}
              className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 rounded transition-colors"
            >
              View All
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl bg-black/40 border border-gray-600 p-4">
          <h3 className="text-lg font-semibold mb-3">Cashout Tiers</h3>
          <div className="space-y-2">
            {TIERS.map((tier) => (
              <div key={tier.coins} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{(tier.coins / 1000).toFixed(1)}k coins</span>
                <span className="font-mono text-green-400">${tier.usd} USD {tier.manualReview && <span className="text-yellow-500 text-xs ml-1">(Manual Review)</span>}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Request a payout when you reach these milestones.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <div className="text-gray-400">Loading transactions...</div>
        </div>
      ) : txs.length === 0 ? (
        <div className="text-center py-12 bg-black/30 rounded-xl border border-gray-600">
          <Coins className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Transactions Yet</h3>
          <p className="text-gray-400 mb-4">Start earning coins by streaming, receiving gifts, or complete activities.</p>
          <button
            onClick={() => navigate("/store")}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Buy Your First Coins
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {txs.map((tx) => (
            <div
              key={tx.id}
              className={`rounded-lg border px-4 py-3 transition-all hover:shadow-lg ${
                tx.coins > 0
                  ? 'bg-green-900/20 border-green-600/40 hover:border-green-500/60'
                  : 'bg-red-900/20 border-red-600/40 hover:border-red-500/60'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`font-semibold ${tx.coins > 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {Number(tx.coins) > 0 ? '+' : ''}{Number(tx.coins || 0).toLocaleString()} coins
                    </div>
                    <div className="text-xs px-2 py-1 rounded-full bg-black/40 border border-gray-600">
                      {tx.type || 'transaction'}
                    </div>
                  </div>
                  
                  {tx.description && (
                    <div className="text-sm text-gray-300 mb-1">
                      {tx.description}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex items-center gap-4">
                      <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                      <span>{format12hr(tx.created_at)}</span>
                      <span>•</span>
                      <span className="capitalize">{tx.source || 'app'}</span>
                      {tx.payment_status && (
                        <>
                          <span>•</span>
                          <span className={`capitalize ${
                            tx.payment_status === 'completed' ? 'text-green-400' :
                            tx.payment_status === 'pending' ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {tx.payment_status}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {tx.external_id && (
                      <div className="text-gray-500 font-mono">
                        ID: {tx.external_id.substring(0, 16)}...
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right ml-4">
                  {tx.usd_amount && Number(tx.usd_amount) > 0 && (
                    <div className={`font-bold ${tx.coins > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${Number(tx.usd_amount).toFixed(2)}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {tx.coins > 0 ? 'Earned' : 'Spent'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

