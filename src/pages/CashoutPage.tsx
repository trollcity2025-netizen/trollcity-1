import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { CASHOUT_TIERS } from '../lib/payoutConfig';

interface CashoutRequest {
  id: string;
  user_id: string;
  requested_coins: number;
  usd_value: number;
  payout_method: string | null;
  payout_details: string | null;
  status: string;
  created_at: string;
}

const CashoutPage: React.FC = () => {
  const { user, profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [existingRequest, setExistingRequest] = useState<CashoutRequest | null>(null);
  const [payoutMethod] = useState('PayPal');
  const [payoutDetails, setPayoutDetails] = useState(''); // PayPal email

  const balance = Number(profile?.troll_coins || 0);

  useEffect(() => {
    if (!user?.id) return;
    const loadExisting = async () => {
      const { data, error } = await supabase
        .from('cashout_requests')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) setExistingRequest(data as CashoutRequest);
      else setExistingRequest(null);
    };
    void loadExisting();
  }, [user?.id]);

  const eligibleTiers = CASHOUT_TIERS.filter(t => balance >= t.coins);

  const handleRequest = async (tierCoins: number, tierUsd: number) => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }
    if (!payoutDetails.trim()) {
      toast.error('Enter your PayPal email');
      return;
    }
    if (existingRequest) {
      toast.error('You already have a pending cashout request');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('cashout_requests').insert([
        {
          user_id: user.id,
          username: profile.username,
          email: profile.email,
          requested_coins: tierCoins,
          usd_value: tierUsd,
          payout_method: payoutMethod,
          payout_details: payoutDetails,
          status: 'pending',
        },
      ]);

      if (error) throw error;

      toast.success('Cashout request submitted for review');
      setExistingRequest({
        id: 'local',
        user_id: user.id,
        requested_coins: tierCoins,
        usd_value: tierUsd,
        payout_method: payoutMethod,
        payout_details: payoutDetails,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to submit cashout request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-[#0B0B12] rounded-2xl border border-purple-500 p-6 shadow-[0_0_25px_rgba(147,51,234,0.5)]">
        <h1 className="text-2xl font-bold mb-1">Cashout Request</h1>
        <p className="text-sm text-gray-300 mb-4">
          Manual payouts only. An admin will review and send your payment, then you'll
          get a confirmation message.
        </p>

        <div className="mb-4 p-3 rounded-xl bg-black/50 border border-purple-500/40">
          <div className="text-xs text-gray-400 mb-1">Your withdrawable balance</div>
          <div className="text-3xl font-bold text-green-400">
            {balance.toLocaleString()} <span className="text-base text-gray-300">coins</span>
          </div>
        </div>

        {existingRequest && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-900/40 border border-yellow-500/50 text-sm">
            <div className="font-semibold text-yellow-300 mb-1">Pending cashout</div>
            <div>
              {existingRequest.requested_coins.toLocaleString()} coins → $
              {Number(existingRequest.usd_value).toFixed(2)} via{' '}
              {existingRequest.payout_method || 'Unknown'}
            </div>
            <div className="text-xs text-gray-300 mt-1">
              Status: {String(existingRequest.status).toUpperCase()}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs mb-1 text-gray-300">Payout method</label>
          <div className="w-full bg-black/70 border border-purple-500/60 rounded-lg px-3 py-2 text-sm">
            PayPal (only)
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs mb-1 text-gray-300">Payout details</label>
          <input
            value={payoutDetails}
            onChange={e => setPayoutDetails(e.target.value)}
            placeholder="PayPal email"
            className="w-full bg-black/70 border border-purple-500/60 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          {CASHOUT_TIERS.map(tier => {
            const canUse = balance >= tier.coins;
            return (
              <button
                key={tier.coins}
                disabled={!canUse || !!existingRequest || loading}
                onClick={() => handleRequest(tier.coins, tier.usd)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm border ${
                  canUse && !existingRequest
                    ? 'bg-purple-500/40 border-purple-500 hover:bg-purple-500/60'
                    : 'bg-gray-900 border-gray-700 opacity-60 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="font-semibold">
                    {tier.coins.toLocaleString()} coins → ${tier.usd.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-gray-300">No payout fee</div>
                </div>
                <span className="text-xs text-gray-200">
                  {canUse ? (existingRequest ? 'Pending...' : 'Request') : 'Not enough coins'}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-gray-400">
          Cashouts are manually reviewed. Processing time 3–7 business days. Coins have no
          direct cash value and can only be redeemed through approved cashout tiers.
        </p>
      </div>
    </div>
  );
};

export default CashoutPage;
