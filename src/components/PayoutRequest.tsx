import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { DollarSign, CreditCard, Clock, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { isPayoutWindowOpen, PAYOUT_WINDOW_LABEL } from '../lib/payoutWindow';

interface PayoutStats {
  total_earned: number;
  total_paid_out: number;
  available_for_payout: number;
  payout_threshold: number;
  can_request_payout: boolean;
}

interface PayoutRequestProps {
  onRequestComplete?: () => void;
}

const PayoutRequest: React.FC<PayoutRequestProps> = ({ onRequestComplete }) => {
  const { user, profile } = useAuthStore();
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [requestAmount, setRequestAmount] = useState<number>(0);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [_hasReducedFees, setHasReducedFees] = useState(false);
  const payoutWindowOpen = isPayoutWindowOpen();

  const checkReducedFees = React.useCallback(async () => {
    try {
      const { data } = await supabase
        .from('creator_migration_claims')
        .select('verification_status, verified_at')
        .eq('user_id', user!.id)
        .maybeSingle();
      
      if (data && data.verification_status === 'approved' && data.verified_at) {
        // Check if within 30 days
        const verifiedAt = new Date(data.verified_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - verifiedAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays <= 30) {
          setHasReducedFees(true);
        }
      }
    } catch (err) {
      console.error('Error checking reduced fees:', err);
    }
  }, [user]);

  const loadPayoutStats = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_available_payout_balance', {
        p_user_id: user!.id
      });

      if (error) throw error;
      if (data && data.length > 0) {
        const s = data[0];
        // Override available_for_payout with client-side logic
        if (profile) {
          const raw = profile.troll_coins || 0;
          const reserved = profile.reserved_troll_coins || 0;
          s.available_for_payout = Math.max(0, raw - reserved);
        }
        // Enforce 12,000 coin minimum threshold client-side
        s.payout_threshold = 12000;
        setStats(s);
      }
    } catch (error) {
      console.error('Error loading payout stats:', error);
      toast.error('Failed to load payout information');
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  const loadPaypalEmail = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('paypal_email')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setPaypalEmail(data.paypal_email || '');
    } catch (error) {
      console.error('Error loading PayPal email:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPayoutStats();
      loadPaypalEmail();
      checkReducedFees();
    }
  }, [user, loadPayoutStats, loadPaypalEmail, checkReducedFees]);

  const savePaypalEmail = async () => {
    if (!paypalEmail || !paypalEmail.includes('@')) {
      toast.error('Please enter a valid PayPal email');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ paypal_email: paypalEmail })
        .eq('id', user!.id);

      if (error) throw error;
      toast.success('PayPal email saved');
    } catch (error) {
      console.error('Error saving PayPal email:', error);
      toast.error('Failed to save PayPal email');
    }
  };

  const submitPayoutRequest = async () => {
    if (!stats || requestAmount <= 0) {
      toast.error('Invalid request amount');
      return;
    }

    if (!profile?.full_name) {
      toast.error('Please complete your profile (Full Name) before requesting a payout');
      return;
    }

    if (requestAmount > stats.available_for_payout) {
      toast.error('Request amount exceeds available balance');
      return;
    }

    if (requestAmount < stats.payout_threshold) {
      toast.error(`Minimum payout is ${stats.payout_threshold.toLocaleString()} coins`);
      return;
    }

    if (!paypalEmail) {
      toast.error('Gift Card email is required');
      return;
    }

    if (!payoutWindowOpen) {
      toast.error(PAYOUT_WINDOW_LABEL);
      return;
    }

    setRequesting(true);
    try {
      const { data, error } = await supabase.rpc('request_payout', {
        p_user_id: user!.id,
        p_requested_coins: requestAmount,
        p_paypal_email: paypalEmail
      });

      if (error) throw error;

      if (data.success) {
        toast.success(
          data.auto_approved
            ? 'Payout request submitted and auto-approved!'
            : 'Payout request submitted for review!'
        );

        // Reset form
        setRequestAmount(0);
        setShowRequestForm(false);

        // Reload stats
        loadPayoutStats();

        onRequestComplete?.();
      } else {
        toast.error(data.error || 'Failed to submit payout request');
      }
    } catch (error: any) {
      console.error('Payout request error:', error);
      toast.error(error.message || 'Failed to submit payout request');
    } finally {
      setRequesting(false);
    }
  };

  const formatUSD = (coins: number) => {
    // Approximate using minimum tier rate for dashboard boxes
    const usd = coins * (25 / 12000);
    return `$${usd.toFixed(2)}`;
  };

  const tierRate = (coins: number) => {
    if (coins >= 120000) return 325 / 120000;
    if (coins >= 60000) return 150 / 60000;
    if (coins >= 30000) return 70 / 30000;
    if (coins >= 12000) return 25 / 12000;
    return 0;
  };

  const FIXED_FEE_USD = 3;

  const calculateFees = (coins: number) => {
    const rate = tierRate(coins);
    const gross = coins * rate;
    const fee = FIXED_FEE_USD;
    const netAmount = Math.max(gross - fee, 0);
    return {
      gross,
      fee,
      net: netAmount
    };
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Unable to Load Payout Info</h3>
        <p className="text-gray-400">Please try again later</p>
      </div>
    );
  }

  const fees = calculateFees(requestAmount);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-500/20 rounded-lg">
          <DollarSign className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Creator Payouts</h3>
          <p className="text-sm text-gray-400">Cash out your earned coins</p>
        </div>
      </div>

      {/* Payout Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Total Earned</span>
          </div>
          <div className="text-lg font-bold text-white">{stats.total_earned.toLocaleString()}</div>
          <div className="text-xs text-gray-500">{formatUSD(stats.total_earned)}</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Paid Out</span>
          </div>
          <div className="text-lg font-bold text-white">{stats.total_paid_out.toLocaleString()}</div>
          <div className="text-xs text-gray-500">{formatUSD(stats.total_paid_out)}</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Available</span>
          </div>
          <div className="text-lg font-bold text-white">{stats.available_for_payout.toLocaleString()}</div>
          <div className="text-xs text-gray-500">{formatUSD(stats.available_for_payout)}</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Threshold</span>
          </div>
          <div className="text-lg font-bold text-white">{stats.payout_threshold.toLocaleString()}</div>
          <div className="text-xs text-gray-500">{formatUSD(stats.payout_threshold)}</div>
        </div>
      </div>

      {/* PayPal Email Setup */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-medium text-white mb-3">PayPal Email</h4>
        <div className="flex gap-2">
          <input
            type="email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={savePaypalEmail}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium transition-colors"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Required for payouts. This email will receive your payments.
        </p>
      </div>

      {!payoutWindowOpen && (
        <div className="mb-6 rounded-lg border border-yellow-500/40 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-200">
          {PAYOUT_WINDOW_LABEL}
        </div>
      )}

      {/* Request Payout Button */}
      {!showRequestForm && (
        <div className="text-center">
          {stats.can_request_payout && payoutWindowOpen ? (
            <button
              onClick={() => setShowRequestForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 mx-auto"
            >
              <DollarSign className="w-5 h-5" />
              Request Payout
            </button>
          ) : (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-yellow-300 font-medium">Payout Not Available</p>
              <p className="text-yellow-400 text-sm">
                {payoutWindowOpen
                  ? `Need ${stats.payout_threshold.toLocaleString()} coins minimum. Currently have ${stats.available_for_payout.toLocaleString()} available.`
                  : PAYOUT_WINDOW_LABEL}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Payout Request Form */}
      {showRequestForm && (
        <div className="bg-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-4">Request Payout</h4>

          <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">
              Amount to Cash Out (Coins) — Minimum 12,000
              </label>
              <input
                type="number"
                value={requestAmount}
                onChange={(e) => setRequestAmount(Math.max(0, parseInt(e.target.value) || 0))}
              min={12000}
              max={stats.available_for_payout}
              className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-400 mt-1">
              Min: {(12000).toLocaleString()} | Max: {stats.available_for_payout.toLocaleString()}
              </p>
            </div>

          {/* Fee Breakdown */}
          {requestAmount > 0 && (
            <div className="bg-gray-600 rounded p-3 mb-4">
              <h5 className="text-sm font-medium text-white mb-2">Payout Breakdown</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Gross Amount:</span>
                  <span className="text-white">${fees.gross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Processing Fee:</span>
                  <span className="text-red-400">-${fees.fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-500 pt-1">
                  <span className="text-white font-medium">Net Payment:</span>
                  <span className="text-green-400 font-bold">${fees.net.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setShowRequestForm(false)}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submitPayoutRequest}
              disabled={requesting || requestAmount < 12000 || requestAmount > stats.available_for_payout || !payoutWindowOpen}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors flex items-center justify-center gap-2"
              >
              {requesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayoutRequest;
