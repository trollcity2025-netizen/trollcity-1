import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";
import { isPayoutWindowOpen, PAYOUT_WINDOW_LABEL } from "../lib/payoutWindow";

export default function Withdraw() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const payoutWindowOpen = isPayoutWindowOpen();

  const loadBalance = useCallback(async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("user_profiles")
      .select("troll_coins, total_earned_coins")
      .eq("id", user.id)
      .single();

    // Use troll_coins for withdrawals (withdrawable coins)
    setBalance(data?.troll_coins || data?.total_earned_coins || 0);
  }, [user]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const requestPayout = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const coinAmount = parseInt(amount, 10);

    if (![12000, 30000, 60000, 120000].includes(coinAmount)) {
      toast.error("Select a valid Visa tier: 12k, 30k, 60k, 120k");
      return;
    }

    if (coinAmount > balance) {
      toast.error("You cannot withdraw more than your balance.");
      return;
    }

    if (!payoutWindowOpen) {
      toast.error(PAYOUT_WINDOW_LABEL);
      return;
    }

    // Check for payment holds
    const { data: holds } = await supabase
      .from('payment_holds')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('hold_type', ['all', 'cashout', 'payout', 'withdrawal'])
      .maybeSingle();

    if (holds) {
      toast.error('Your account has an active payout hold. Please contact support.');
      return;
    }

    const tiers = [
      { coins: 12000, usd: 25 },
      { coins: 30000, usd: 70 },
      { coins: 60000, usd: 150 },
      { coins: 120000, usd: 325 },
    ] as const;
    const tier = tiers.find(t => t.coins === coinAmount);
    if (!tier) {
      toast.error("Select a valid PayPal tier: 12k, 30k, 60k, 120k");
      return;
    }
    const { data, error } = await supabase.rpc('request_visa_redemption', {
      p_user_id: user.id,
      p_coins: tier.coins,
      p_usd: tier.usd
    });

    if (error) {
      console.error("Payout request error:", error);
      return toast.error("Error submitting request");
    }
    
    toast.success(`PayPal payout request created: ID ${String(data?.redemption_id || '')}`);
    setAmount("");
    loadBalance();
  };

  return (
    <div className="min-h-screen bg-[#0A0814] p-6">
      <div className="max-w-md mx-auto text-white">
        <h2 className="text-2xl font-bold mb-4">Withdraw Earnings</h2>

        <p className="mb-2">
          <strong>Your Balance:</strong> {balance.toLocaleString()} coins  
          {/* Approximate using minimum tier rate */}
          (${(balance * (25 / 12000)).toFixed(2)})
        </p>

        {!payoutWindowOpen && (
          <div className="mb-3 rounded-lg border border-yellow-500/40 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-200">
            {PAYOUT_WINDOW_LABEL}
          </div>
        )}

        <input
          type="number"
          className="w-full p-2 rounded bg-zinc-800 text-white placeholder-gray-400 mb-3 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Enter tier: 12000, 30000, 60000, 120000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button
          onClick={requestPayout}
          className="bg-green-500 hover:bg-green-600 w-full mt-3 py-2 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!amount || ![12000,30000,60000,120000].includes(parseInt(amount)) || parseInt(amount) > balance || !payoutWindowOpen}
        >
          Request Withdrawal
        </button>
      </div>
    </div>
  );
}


