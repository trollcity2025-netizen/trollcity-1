import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase, getSystemSettings, getCountdown } from '../lib/supabase';
import { toast } from 'sonner';
import { CASHOUT_TIERS } from '../lib/payoutConfig';
import { CreditCard, Smartphone, CheckCircle, AlertTriangle, ShieldCheck, Loader2, Lock } from 'lucide-react';

import { Link } from 'react-router-dom';

interface CashoutRequest {
  id: string;
  user_id: string;
  requested_coins: number;
  usd_value: number;
  payout_method: string | null;
  payout_details: string | null;
  status: string;
  created_at: string;
  gift_card_code?: string;
  gift_card_provider?: string;
  delivery_method?: string;
  is_held?: boolean;
  held_reason?: string;
  release_date?: string;
  is_new_user_hold?: boolean;
}

const CashoutPage: React.FC = () => {
  const { user, profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [existingRequest, setExistingRequest] = useState<CashoutRequest | null>(null);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [unlockAt, setUnlockAt] = useState<string | null>(null);
  
  // Wizard State
  const [step, setStep] = useState(1);
  const [selectedCard, setSelectedCard] = useState<'Visa' | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'App Delivery' | null>(null);
  const [selectedTier, setSelectedTier] = useState<{coins: number, usd: number} | null>(null);

  const rawBalance = Number(profile?.troll_coins || 0);
  const reserved = Number(profile?.reserved_troll_coins || 0);
  const balance = Math.max(0, rawBalance - reserved);

  useEffect(() => {
    if (!user?.id) return;
    const loadExisting = async () => {
      const { data, error } = await supabase
        .from('cashout_requests')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) setExistingRequest(data as CashoutRequest);
      else setExistingRequest(null);
    };
    void loadExisting();
  }, [user?.id]);

  useEffect(() => {
    const loadLock = async () => {
      const s = await getSystemSettings()
      setLockEnabled(Boolean(s?.payout_lock_enabled))
      setUnlockAt(s?.payout_unlock_at || null)
    }
    void loadLock()
  }, [])

  const handleCancel = async () => {
    if (!existingRequest || !user) return;
    
    if (!confirm('Are you sure you want to cancel this cashout request? The reserved coins will be returned to your balance immediately.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('cancel_cashout_request', {
        p_request_id: existingRequest.id,
        p_user_id: user.id
      });

      if (error) throw error;

      toast.success('Cashout request cancelled');
      setExistingRequest(null);
      // Refresh profile to update balance is handled by realtime subscription or reload
      // For now, we force a reload to ensure balance is fresh
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to cancel request');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  const runSecurityChecks = async () => {
    setLoading(true);
    try {
      if (!profile) throw new Error('Profile not loaded');

      // 1. Account Age Check (48 hours)
      const created = new Date(profile.created_at || Date.now());
      const ageHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
      if (ageHours < 48) {
        throw new Error(`Account must be at least 48 hours old to cash out. (Current: ${Math.floor(ageHours)}h)`);
      }

      // 2. Tax Compliance Check ($600 threshold)
      if (selectedTier && selectedTier.usd >= 600) {
        // Fetch latest tax status directly to be safe
        const { data: taxInfo } = await supabase
          .from('user_tax_info')
          .select('w9_status')
          .eq('user_id', user?.id)
          .single();
        
        const isVerified = taxInfo?.w9_status === 'verified' || profile.w9_status === 'verified';
        if (!isVerified) {
          throw new Error('Tax form (W-9) verification is required for payouts over $600. Please complete onboarding in Settings.');
        }
      }

      // Simulate network checks
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      handleNextStep();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !profile || !selectedTier) return;
    if (lockEnabled) {
      toast.error('Payouts are locked during Launch Trial Mode.')
      return
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.rpc('submit_cashout_request', {
        p_user_id: user.id,
        p_amount_coins: selectedTier.coins,
        p_usd_value: selectedTier.usd,
        p_provider: 'Visa',
        p_delivery_method: 'App Delivery'
      });

      if (error) throw error;

      toast.success('Cashout request submitted successfully');
      handleNextStep(); // Go to Step 7
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to submit cashout request');
    } finally {
      setLoading(false);
    }
  };

  if (lockEnabled) {
    const c = getCountdown(unlockAt)
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-[#0B0B12] rounded-2xl border border-yellow-500 p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Payouts are locked</h1>
          <p className="text-yellow-300 mb-4">Unlocks in {c.days}d {c.hours}h {c.minutes}m {c.seconds}s</p>
          <p className="text-gray-300">Payouts are locked during the 2-week launch trial. Unlocks when the trial ends.</p>
          <Link to="/payout-status" className="text-purple-400 hover:text-purple-300 underline text-sm mt-4 inline-block">
            View Launch Trial Status
          </Link>
        </div>
      </div>
    )
  }

  if (existingRequest) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-[#0B0B12] rounded-2xl border border-purple-500 p-6 shadow-[0_0_25px_rgba(147,51,234,0.5)] text-center">
          <h1 className="text-2xl font-bold mb-4">Active Cashout Request</h1>
          <div className="p-4 bg-yellow-900/20 border border-yellow-500/50 rounded-xl mb-6">
            <div className="text-3xl font-bold text-yellow-400 mb-2">
              ${existingRequest.usd_value.toFixed(2)}
            </div>
            <div className="text-sm text-gray-300">
              via {existingRequest.gift_card_provider || existingRequest.payout_method} ({existingRequest.delivery_method || 'App Delivery'})
            </div>
            <div className="mt-4 inline-block px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-sm font-bold uppercase">
              {existingRequest.status}
            </div>
          </div>

          {existingRequest.is_held && (
            <div className="bg-orange-900/20 border border-orange-500/50 rounded-xl p-4 mb-6 text-left">
                <h3 className="text-orange-400 font-bold flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4" />
                    Request On Hold
                </h3>
                <p className="text-sm text-gray-300 mb-2">
                    Your payout request is currently on hold.
                    {existingRequest.is_new_user_hold && " (New User Security Hold)"}
                </p>
                {existingRequest.release_date && (
                    <p className="text-xs text-orange-300">
                        Estimated Release: {new Date(existingRequest.release_date).toLocaleDateString()}
                    </p>
                )}
                {existingRequest.held_reason && !existingRequest.is_new_user_hold && (
                    <p className="text-xs text-gray-400 mt-1">
                        Reason: {existingRequest.held_reason}
                    </p>
                )}
            </div>
          )}

          <p className="text-gray-400 text-sm mb-6">
            Your request is being processed. You will receive a notification when your payout is ready.
          </p>

          {existingRequest.status === 'pending' && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="mb-6 w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900 rounded-lg text-sm font-medium transition-all"
            >
              {loading ? 'Cancelling...' : 'Cancel Request & Refund Coins'}
            </button>
          )}

          <Link to="/wallet" className="text-purple-400 hover:text-purple-300 underline text-sm">
            Back to Wallet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-[#0B0B12] rounded-2xl border border-purple-500 p-6 shadow-[0_0_25px_rgba(147,51,234,0.5)] text-center">
        <h1 className="text-2xl font-bold mb-4">Request Payout</h1>
        <p className="text-gray-300 text-sm mb-4">
          PayPal payouts are processed 2 times a week (Monday and Fridays).
        </p>
        <p className="text-gray-400 text-sm mb-6">
          Please use the new Payout Request page to submit your request.
        </p>
        <Link
          to="/payouts/request"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-semibold"
        >
          Go to Payout Request
        </Link>
      </div>
    </div>
  );
};

export default CashoutPage;
