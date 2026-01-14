// src/pages/admin/BucketsDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { 
  DollarSign, 
  Coins, 
  Shield, 
  Lock, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  FileText,
  Clock
} from 'lucide-react';

interface BucketData {
  bucket_type: string;
  balance_usd: number;
  balance_coins: number;
  total_coins_issued: number;
  total_coins_earned: number;
  estimated_liability_usd: number;
  last_updated_at: string;
  description: string;
}

interface LedgerTransaction {
  id: string;
  transaction_type: string;
  source_type: string;
  source_id: string;
  usd_amount: number;
  coin_amount: number;
  description: string;
  created_at: string;
  user_username?: string;
}

interface PayoutSummary {
  pending_count: number;
  pending_amount: number;
  pending_funds_count: number;
  pending_funds_amount: number;
  approved_count: number;
  approved_amount: number;
}

export default function BucketsDashboard() {
  const { user } = useAuthStore();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSecretary, setIsSecretary] = useState(false);
  
  const [buckets, setBuckets] = useState<BucketData[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!user) {
      setIsAuthorized(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data: profileData, error } = await supabase
        .from('user_profiles')
        .select('role, is_admin')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking access:', error);
        setIsAuthorized(false);
        return;
      }

      const isAdmin = profileData?.role === 'admin' || profileData?.is_admin === true;
      const isSecretaryRole = profileData?.role === 'secretary';

      setIsAuthorized(isAdmin);
      setIsSecretary(isSecretaryRole);
    } catch (err) {
      console.error('Access check error:', err);
      setIsAuthorized(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const loadBuckets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_buckets_summary_for_user');

      if (error) {
        console.error('Error loading buckets:', error);
        toast.error('Failed to load bucket data');
        return;
      }

      if (data && data.length > 0) {
        const summary = data[0];
        // Convert to bucket format for the UI
        const bucketData: BucketData[] = [];
        
        // Admin spendable (only visible if can_view_admin_spendable is true)
        if (summary.can_view_admin_spendable && summary.admin_spendable_usd !== null) {
          bucketData.push({
            bucket_type: 'admin_spendable',
            balance_usd: summary.admin_spendable_usd || 0,
            balance_coins: 0,
            total_coins_issued: 0,
            total_coins_earned: 0,
            estimated_liability_usd: 0,
            last_updated_at: new Date().toISOString(),
            description: '💰 Admin Spendable - Money you can personally spend'
          });
        }
        
        bucketData.push({
          bucket_type: 'broadcaster_liability',
          balance_usd: summary.broadcaster_liability_usd || 0,
          balance_coins: 0,
          total_coins_issued: 0,
          total_coins_earned: summary.total_coins_earned || 0,
          estimated_liability_usd: 0,
          last_updated_at: new Date().toISOString(),
          description: '📊 Broadcaster Liability - Money owed to broadcasters (DO NOT SPEND)'
        });
        
        if (!isSecretary) {
          bucketData.push({
            bucket_type: 'admin_issued_coins_liability',
            balance_usd: summary.admin_issued_liability_usd || 0,
            balance_coins: summary.admin_issued_coins_coins || 0,
            total_coins_issued: summary.total_coins_issued || 0,
            total_coins_earned: 0,
            estimated_liability_usd: summary.admin_issued_liability_usd || 0,
            last_updated_at: new Date().toISOString(),
            description: '🪙 Admin Issued Coins - Coins granted by admin with payout liability'
          });
        }
        
        bucketData.push({
          bucket_type: 'reserved_payout',
          balance_usd: summary.reserved_payout_usd || 0,
          balance_coins: 0,
          total_coins_issued: 0,
          total_coins_earned: 0,
          estimated_liability_usd: 0,
          last_updated_at: new Date().toISOString(),
          description: '🔒 Reserved Payout - Funds reserved for pending payouts'
        });
        
        bucketData.push({
          bucket_type: 'paid_out',
          balance_usd: summary.paid_out_usd || 0,
          balance_coins: 0,
          total_coins_issued: 0,
          total_coins_earned: 0,
          estimated_liability_usd: 0,
          last_updated_at: new Date().toISOString(),
          description: '✅ Paid Out - Total funds paid out to broadcasters'
        });
        
        setBuckets(bucketData);
      }
    } catch (err) {
      console.error('Buckets load error:', err);
    }
  }, [isSecretary]);

  const loadTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ledger_recent')
        .select('*')
        .limit(50);

      if (error) {
        console.error('Error loading transactions:', error);
        return;
      }

      setTransactions(data || []);
    } catch (err) {
      console.error('Transactions load error:', err);
    }
  }, []);

  const loadPayoutSummary = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_pending_payouts_summary');

      if (error) {
        console.error('Error loading payout summary:', error);
        return;
      }

      setPayoutSummary(data as PayoutSummary);
    } catch (err) {
      console.error('Payout summary load error:', err);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadBuckets(),
      loadTransactions(),
      loadPayoutSummary()
    ]);
    setIsRefreshing(false);
  }, [loadBuckets, loadTransactions, loadPayoutSummary]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (isAuthorized) {
      loadAllData();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(loadAllData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized, loadAllData]);

  // Helper functions
  const getAdminSpendable = () => {
    const bucket = buckets.find(b => b.bucket_type === 'admin_spendable');
    return bucket?.balance_usd || 0;
  };

  const getBroadcasterLiability = () => {
    const bucket = buckets.find(b => b.bucket_type === 'broadcaster_liability');
    return bucket?.balance_usd || 0;
  };

  const getReservedPayout = () => {
    const bucket = buckets.find(b => b.bucket_type === 'reserved_payout');
    return bucket?.balance_usd || 0;
  };

  const getPaidOut = () => {
    const bucket = buckets.find(b => b.bucket_type === 'paid_out');
    return bucket?.balance_usd || 0;
  };

  const getAvailableForPayout = () => {
    return getBroadcasterLiability() - getReservedPayout();
  };

  const getAdminIssuedCoins = () => {
    const bucket = buckets.find(b => b.bucket_type === 'admin_issued_coins_liability');
    return bucket?.balance_coins || 0;
  };

  const getAdminIssuedLiability = () => {
    const bucket = buckets.find(b => b.bucket_type === 'admin_issued_coins_liability');
    return bucket?.estimated_liability_usd || 0;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatCoins = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'paypal_purchase': return 'text-green-400';
      case 'coin_grant_admin': return 'text-yellow-400';
      case 'coin_grant_broadcast': return 'text-blue-400';
      case 'payout_reserved': return 'text-orange-400';
      case 'payout_completed': return 'text-purple-400';
      case 'payout_released': return 'text-gray-400';
      default: return 'text-white';
    }
  };

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'paypal_purchase': return <ArrowUpRight className="w-4 h-4" />;
      case 'payout_completed': return <CheckCircle className="w-4 h-4" />;
      case 'payout_reserved': return <Lock className="w-4 h-4" />;
      case 'coin_grant_admin': return <Coins className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="px-6 py-3 rounded bg-red-950 border border-red-500 text-center">
          <p className="font-bold mb-1">Access Restricted</p>
          <p className="text-sm text-red-200">
            This dashboard is limited to administrators only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">💰 Financial Buckets Dashboard</h1>
            <p className="text-gray-400 text-sm">
              Real-time tracking of platform funds and payout reserves
            </p>
          </div>
          <button
            onClick={loadAllData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Main Balance Card - Available to Spend */}
        <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm font-medium uppercase tracking-wider">Available to Spend</p>
              <p className="text-4xl font-bold text-white mt-1">{formatCurrency(getAdminSpendable())}</p>
              <p className="text-gray-400 text-sm mt-2">
                💡 This is your personal spending balance from PayPal purchases
              </p>
            </div>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Bucket Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Admin Spendable */}
          <div className="bg-[#1A1A1A] border border-green-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Admin Spendable</h3>
                <p className="text-xs text-gray-400">Your personal funds</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(getAdminSpendable())}</p>
            <p className="text-xs text-gray-500 mt-1">From $1 per PayPal transaction</p>
          </div>

          {/* Broadcaster Liability */}
          <div className="bg-[#1A1A1A] border border-yellow-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Broadcaster Liability</h3>
                <p className="text-xs text-gray-400">DO NOT SPEND</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{formatCurrency(getBroadcasterLiability())}</p>
            <p className="text-xs text-gray-500 mt-1">Money owed to broadcasters</p>
          </div>

          {/* Reserved Payout */}
          <div className="bg-[#1A1A1A] border border-orange-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Reserved Payout</h3>
                <p className="text-xs text-gray-400">Pending payouts</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-orange-400">{formatCurrency(getReservedPayout())}</p>
            <p className="text-xs text-gray-500 mt-1">Reserved for approved payouts</p>
          </div>

          {/* Available for Payout */}
          <div className="bg-[#1A1A1A] border border-blue-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Available for Payout</h3>
                <p className="text-xs text-gray-400">Can be paid out</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(getAvailableForPayout())}</p>
            <p className="text-xs text-gray-500 mt-1">Liability - Reserved</p>
          </div>

          {/* Paid Out */}
          <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Paid Out</h3>
                <p className="text-xs text-gray-400">Total completed payouts</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-purple-400">{formatCurrency(getPaidOut())}</p>
            <p className="text-xs text-gray-500 mt-1">Lifetime payout total</p>
          </div>

          {/* Admin Issued Coins */}
          {!isSecretary && (
            <div className="bg-[#1A1A1A] border border-yellow-500/30 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Coins className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Admin Issued Coins</h3>
                  <p className="text-xs text-gray-400">System-granted coins</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-yellow-400">{formatCoins(getAdminIssuedCoins())}</p>
              <p className="text-xs text-gray-500 mt-1">≈ {formatCurrency(getAdminIssuedLiability())} liability</p>
            </div>
          )}
        </div>

        {/* Payout Safeguard Status */}
        {payoutSummary && (
          <div className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4">🛡️ Payout Safeguard Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0A0814] rounded-lg p-3">
                <p className="text-gray-400 text-xs">Pending</p>
                <p className="text-xl font-bold text-white">{payoutSummary.pending_count}</p>
                <p className="text-xs text-gray-500">{formatCurrency(payoutSummary.pending_amount)}</p>
              </div>
              <div className="bg-[#0A0814] rounded-lg p-3">
                <p className="text-orange-400 text-xs">Pending Funds ⚠️</p>
                <p className="text-xl font-bold text-orange-400">{payoutSummary.pending_funds_count}</p>
                <p className="text-xs text-gray-500">{formatCurrency(payoutSummary.pending_funds_amount)}</p>
              </div>
              <div className="bg-[#0A0814] rounded-lg p-3">
                <p className="text-green-400 text-xs">Approved</p>
                <p className="text-xl font-bold text-green-400">{payoutSummary.approved_count}</p>
                <p className="text-xs text-gray-500">{formatCurrency(payoutSummary.approved_amount)}</p>
              </div>
              <div className="bg-[#0A0814] rounded-lg p-3">
                <p className="text-blue-400 text-xs">Total Reserved</p>
                <p className="text-xl font-bold text-blue-400">{formatCurrency(getReservedPayout())}</p>
                <p className="text-xs text-gray-500">For approved payouts</p>
              </div>
            </div>
          </div>
        )}

        {/* Ledger Transactions Table */}
        <div className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">📋 Recent Ledger Transactions</h3>
            <span className="text-xs text-gray-400">Last 50 transactions</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-[#2C2C2C]">
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Source</th>
                  <th className="pb-3 pr-4">USD Amount</th>
                  <th className="pb-3 pr-4">Coins</th>
                  <th className="pb-3 pr-4">Description</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#2C2C2C] hover:bg-[#252525]">
                    <td className="py-3 pr-4">
                      <div className={`flex items-center gap-2 ${getTransactionTypeColor(tx.transaction_type)}`}>
                        {getTransactionTypeIcon(tx.transaction_type)}
                        <span className="capitalize">{tx.transaction_type.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">{tx.source_type}</td>
                    <td className="py-3 pr-4 text-green-400">{tx.usd_amount > 0 ? formatCurrency(tx.usd_amount) : '-'}</td>
                    <td className="py-3 pr-4 text-yellow-400">{tx.coin_amount > 0 ? formatCoins(tx.coin_amount) : '-'}</td>
                    <td className="py-3 pr-4 text-gray-300 max-w-xs truncate">{tx.description || '-'}</td>
                    <td className="py-3 text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {transactions.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No transactions yet. PayPal purchases will appear here.
            </div>
          )}
        </div>

        {/* Safety Notice */}
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-400">Safety Guidelines</h4>
              <ul className="text-sm text-gray-300 mt-2 space-y-1">
                <li>• Only spend from the <strong>Admin Spendable</strong> bucket</li>
                <li>• Never touch <strong>Broadcaster Liability</strong> - this money belongs to creators</li>
                <li>• Payout requests are validated against broadcaster liability before approval</li>
                <li>• Insufficient funds will mark payouts as "pending_funds" until money is available</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
