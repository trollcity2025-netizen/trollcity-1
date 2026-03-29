import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { CreditCard, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TIERS } from '@/config/coinConfig';

export default function PastorPayouts() {
  const { profile, refreshProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<{coins: number, usd: number} | null>(null);

  // Available balance
  const rawBalance = Number(profile?.troll_coins || 0);
  const reserved = Number(profile?.reserved_troll_coins || 0);
  const balance = Math.max(0, rawBalance - reserved);

  const handleRequestPayout = async () => {
    if (!profile || !selectedTier) return;
    
    // Check if PayPal is connected
    if (!profile.payout_paypal_email) {
      toast.error('Please connect your PayPal email in Wallet settings first.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('submit_cashout_request', {
        p_user_id: profile.id,
        p_amount_coins: selectedTier.coins,
        p_usd_value: selectedTier.usd,
        p_provider: 'PayPal',
        p_delivery_method: 'PayPal Transfer',
        p_payout_details: profile.payout_paypal_email
      });

      if (error) throw error;

      toast.success('Payout request submitted successfully!');
      setSelectedTier(null);
      refreshProfile(); // Update balance
    } catch (err: any) {
      console.error('Payout error:', err);
      toast.error(err.message || 'Failed to submit payout request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-500/20 rounded-lg">
          <DollarSign className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Pastor Payouts</h2>
          <p className="text-sm text-gray-400">Convert your earned coins to cash via PayPal</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Balance Card */}
        <div className="bg-black/40 border border-zinc-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Available Balance</div>
          <div className="text-3xl font-bold text-purple-400">{balance.toLocaleString()} <span className="text-sm text-purple-300/70">Coins</span></div>
          {reserved > 0 && (
            <div className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
              <AlertCircle size={12} />
              {reserved.toLocaleString()} coins reserved/pending
            </div>
          )}
        </div>

        {/* PayPal Status */}
        <div className="bg-black/40 border border-zinc-700 rounded-lg p-4 flex flex-col justify-center">
          <div className="text-sm text-gray-400 mb-1">Payout Method</div>
          {profile?.payout_paypal_email ? (
            <div>
              <div className="flex items-center gap-2 text-green-400 font-medium">
                <CreditCard size={16} />
                PayPal Connected
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate">{profile.payout_paypal_email}</div>
            </div>
          ) : (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              No PayPal Connected
              <a href="/payouts/setup" className="text-blue-400 hover:underline ml-1">Connect Now</a>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-white">Select Payout Tier</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIERS.map((tier, index) => {
            const isSelected = selectedTier?.coins === tier.coins;
            const canAfford = balance >= tier.coins;
            
            return (
              <button
                key={index}
                onClick={() => canAfford && setSelectedTier({ coins: tier.coins, usd: tier.usd })}
                disabled={!canAfford}
                className={`
                  relative p-4 rounded-xl border text-left transition-all
                  ${isSelected 
                    ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500' 
                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                  }
                  ${!canAfford && 'opacity-50 cursor-not-allowed'}
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-2xl font-bold text-white">${tier.usd}</span>
                  {tier.manualReview && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                      3 DAY MANUAL
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  {tier.coins.toLocaleString()} Coins
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-zinc-800 flex justify-end">
        <button
          onClick={handleRequestPayout}
          disabled={loading || !selectedTier || !profile?.payout_paypal_email}
          className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-green-900/20"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <DollarSign size={18} />}
          {selectedTier ? `Request $${selectedTier.usd} Payout` : 'Select a Tier'}
        </button>
      </div>
    </div>
  );
}
