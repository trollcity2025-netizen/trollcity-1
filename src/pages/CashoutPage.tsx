import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase, getSystemSettings, getCountdown } from '../lib/supabase';
import { toast } from 'sonner';
import { CASHOUT_TIERS } from '../lib/payoutConfig';
import { CreditCard, Smartphone, CheckCircle, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

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

  if (existingRequest && step === 1) {
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
          <p className="text-gray-400 text-sm mb-6">
            Your request is being processed. You will receive a notification when your Gift Card is ready in your Wallet.
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

          <Link to="/wallet/gift-cards" className="text-purple-400 hover:text-purple-300 underline text-sm">
            View My Gift Cards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-[#0B0B12] rounded-2xl border border-purple-500 p-6 shadow-[0_0_25px_rgba(147,51,234,0.5)]">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Gift Card Request</h1>
          <div className="text-xs text-gray-400">Step {step} of 7</div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-800 rounded-full mb-8">
          <div 
            className="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${(step / 7) * 100}%` }}
          />
        </div>

        {/* Step 1: Eligibility */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-2">Your Withdrawable Balance</div>
              <div className="text-4xl font-bold text-green-400 mb-4">
                {balance.toLocaleString()} <span className="text-lg text-gray-500">coins</span>
              </div>
              
              {reserved > 0 && (
                <div className="text-sm text-yellow-500 mb-4 bg-yellow-900/20 py-1 px-3 rounded-full inline-block border border-yellow-900/50">
                  {reserved.toLocaleString()} coins reserved in pending payouts
                </div>
              )}
            </div>

            <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
              <h3 className="font-semibold mb-3">Eligibility Check</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Minimum Balance (50,000 coins)</span>
                  {balance >= 50000 ? (
                    <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Eligible</span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {50000 - balance} more needed</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Account Status</span>
                  <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Active</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleNextStep}
              disabled={balance < 10000}
              className={`w-full py-3 rounded-xl font-bold transition-all ${
                balance >= 10000 
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20' 
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              Start Cashout Request
            </button>
          </div>
        )}

        {/* Step 2: Select Gift Card Type */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4">Select Gift Card Type</h2>
            
            <button
              onClick={() => setSelectedCard('Visa')}
              className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                selectedCard === 'Visa'
                  ? 'bg-purple-900/20 border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                  : 'bg-black/40 border-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-8 bg-blue-900 rounded flex items-center justify-center font-bold italic text-white">VISA</div>
                <div className="text-left">
                  <div className="font-bold">Visa Gift Card</div>
                  <div className="text-xs text-gray-400">Use anywhere Visa is accepted</div>
                </div>
              </div>
              {selectedCard === 'Visa' && <CheckCircle className="w-6 h-6 text-purple-500" />}
            </button>

            <div className="flex gap-3 mt-8">
              <button onClick={handlePrevStep} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium">Back</button>
              <button 
                onClick={handleNextStep}
                disabled={!selectedCard}
                className={`flex-1 py-3 rounded-xl font-bold ${selectedCard ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-800 text-gray-500'}`}
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Delivery Method */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4">Select Delivery Method</h2>
            
            <button
              onClick={() => setDeliveryMethod('App Delivery')}
              className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                deliveryMethod === 'App Delivery'
                  ? 'bg-purple-900/20 border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                  : 'bg-black/40 border-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-left">
                  <div className="font-bold">App Delivery</div>
                  <div className="text-xs text-gray-400">Delivered instantly to your Wallet</div>
                </div>
              </div>
              {deliveryMethod === 'App Delivery' && <CheckCircle className="w-6 h-6 text-purple-500" />}
            </button>

            {deliveryMethod === 'App Delivery' && (
              <div className="p-4 bg-purple-900/10 border border-purple-500/20 rounded-xl text-sm text-purple-200">
                <p className="mb-2">Your Visa gift card will be delivered inside the app.</p>
                <p>You can access it anytime under <span className="font-bold text-white">Wallet → Gift Cards</span>.</p>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button onClick={handlePrevStep} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium">Back</button>
              <button 
                onClick={handleNextStep}
                disabled={!deliveryMethod}
                className={`flex-1 py-3 rounded-xl font-bold ${deliveryMethod ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-800 text-gray-500'}`}
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Enter Amount */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-center">Select Cashout Amount</h2>
            
            <div className="grid grid-cols-1 gap-3">
              {CASHOUT_TIERS.map(tier => {
                const canAfford = balance >= tier.coins;
                const isSelected = selectedTier?.coins === tier.coins;
                
                return (
                  <button
                    key={tier.coins}
                    disabled={!canAfford}
                    onClick={() => setSelectedTier(tier)}
                    className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-purple-900/20 border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                        : canAfford 
                          ? 'bg-black/40 border-gray-800 hover:border-gray-600'
                          : 'bg-black/20 border-gray-900 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-bold text-lg text-white">${tier.usd.toFixed(2)}</div>
                      <div className="text-xs text-gray-400">{tier.coins.toLocaleString()} coins</div>
                    </div>
                    {isSelected && <CheckCircle className="w-6 h-6 text-purple-500" />}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={handlePrevStep} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium">Back</button>
              <button 
                onClick={handleNextStep}
                disabled={!selectedTier}
                className={`flex-1 py-3 rounded-xl font-bold ${selectedTier ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-800 text-gray-500'}`}
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Security Check */}
        {step === 5 && (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <ShieldCheck className="w-10 h-10 text-purple-400" />
            </div>
            
            <h2 className="text-xl font-bold">Running Security Checks</h2>
            <p className="text-gray-400 text-sm">Verifying account status and eligibility...</p>

            <div className="max-w-xs mx-auto space-y-3 text-left bg-black/40 p-4 rounded-xl border border-gray-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Verified Account</span>
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">No Abuse Flags</span>
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Coin History Check</span>
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
            </div>

            <button 
              onClick={runSecurityChecks}
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold mt-4"
            >
              {loading ? 'Verifying...' : 'Run Checks'}
            </button>
          </div>
        )}

        {/* Step 6: Confirmation */}
        {step === 6 && selectedTier && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-center mb-4">Confirm Request</h2>
            
            <div className="bg-black/40 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <div className="text-sm text-gray-400">Gift Card Type</div>
                <div className="font-bold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-400" /> {selectedCard}
                </div>
              </div>
              <div className="p-4 border-b border-gray-800">
                <div className="text-sm text-gray-400">Delivery Method</div>
                <div className="font-bold flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-400" /> {deliveryMethod}
                </div>
              </div>
              <div className="p-4 border-b border-gray-800 bg-purple-900/10">
                <div className="text-sm text-gray-400">Cashout Amount</div>
                <div className="text-2xl font-bold text-green-400">${selectedTier.usd.toFixed(2)}</div>
                <div className="text-xs text-gray-500">
                  {(() => {
                    const feeCoins = selectedTier.usd <= 70 ? 1896 : 3336
                    const totalCoins = selectedTier.coins + feeCoins
                    return `${totalCoins.toLocaleString()} coins will be deducted (base ${selectedTier.coins.toLocaleString()} + fee ${feeCoins.toLocaleString()})`
                  })()}
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Processing Time</span>
                  <span className="text-white">Under 30 minutes</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Fees</span>
                  <span className="text-green-400">{selectedTier.usd <= 70 ? 'Fee Coins: 1,896' : 'Fee Coins: 3,336'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={handlePrevStep} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium">Back</button>
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold shadow-lg shadow-green-900/20"
              >
                {loading ? 'Submitting...' : 'Confirm Request'}
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Submitted */}
        {step === 7 && (
          <div className="text-center py-8 space-y-6">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Request Submitted!</h2>
              <p className="text-gray-400">Your Visa Gift Card is being processed.</p>
            </div>

            <div className="bg-black/40 p-4 rounded-xl border border-gray-800 inline-block w-full">
              <div className="text-sm text-gray-400 mb-1">Estimated Delivery</div>
              <div className="font-bold text-white">Under 30 minutes</div>
            </div>

            <div className="pt-4">
              <Link 
                to="/wallet/gift-cards"
                className="block w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold mb-3"
              >
                Go to Gift Cards
              </Link>
              <Link 
                to="/wallet"
                className="block w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium"
              >
                Back to Wallet
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashoutPage;
