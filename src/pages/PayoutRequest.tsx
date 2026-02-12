import React, { useState } from "react";
import { useAuthStore } from "../lib/store";
import { useBank } from "@/lib/hooks/useBank";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { DollarSign, ArrowRight } from "lucide-react";
import { isPayoutWindowOpen, PAYOUT_WINDOW_LABEL } from "../lib/payoutWindow";
import { TIERS, FIXED_FEE_USD, getRateForCoins } from "../lib/payoutTiers";

export default function PayoutRequest() {
  const { user, profile, refreshProfile } = useAuthStore() as any;
  const { creditInfo } = useBank();
  const creditUsed = creditInfo.used;
  const [coins, setCoins] = useState("");
  const [loading, setLoading] = useState(false);
  const payoutWindowOpen = isPayoutWindowOpen();

  if (!user) {
    return (
      <div className="p-6 text-center text-white min-h-screen flex items-center justify-center">
        <div>Please log in to request a payout.</div>
      </div>
    );
  }

  const raw = profile?.troll_coins ?? 0;
  const reserved = profile?.reserved_troll_coins ?? 0;
  const balance = Math.max(0, raw - reserved);
  
  const parsed = Number(coins || "0");
  const rate = getRateForCoins(parsed);
  const grossUsd = parsed > 0 ? parsed * rate : 0;
  const netUsd = Math.max(grossUsd - FIXED_FEE_USD, 0);

  const payoutsDisabled = false;

  if (payoutsDisabled) {
    return (
      <div className="p-6 max-w-xl mx-auto text-white min-h-screen flex items-center">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Payouts Unavailable</h1>
          <p className="text-sm text-gray-300">
            Gift card payouts and cashouts are no longer supported.
          </p>
          <p className="text-xs text-gray-500">
            You can continue to earn and spend coins inside Troll City. Check back
            later for updated payout options.
          </p>
        </div>
      </div>
    );
  }

  const submit = async () => {
    try {
      setLoading(true);
      const num = Number(coins);
      
      if (!num || num <= 0) {
        toast.error("Enter a valid coin amount.");
        return;
      }

      if (!payoutWindowOpen) {
        toast.error(PAYOUT_WINDOW_LABEL);
        return;
      }
      
      const validAmounts: number[] = TIERS.map(t => t.coins);
      if (!validAmounts.includes(num)) {
        toast.error(`Select a valid Cashout tier: ${validAmounts.map(a => (a/1000).toFixed(1) + 'k').join(', ')}.`);
        return;
      }
      
      if (num > balance) {
        toast.error("You don't have that many troll_coins.");
        return;
      }
      const tier = TIERS.find(t => t.coins === num);
      if (!tier) {
        toast.error("Select a valid Cashout tier.");
        return;
      }

      if (tier.manualReview) {
        toast.info("This amount requires manual review and may take longer to process.");
      }

      const { data, error } = await supabase.rpc('request_visa_redemption', {
        p_user_id: user.id,
        p_coins: tier.coins,
        p_usd: tier.usd
      });
      if (error) {
        throw new Error(error.message || "Failed to request redemption");
      }
      
      if (refreshProfile) await refreshProfile();
      
      toast.success(`Visa redemption created: ID ${String(data?.redemption_id || '')}`);
      setCoins("");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to request payout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto text-white min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="w-8 h-8 text-purple-400" />
        <h1 className="text-2xl font-bold">Request Payout</h1>
      </div>

      <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-6 space-y-4">
        <div>
          <p className="text-sm opacity-70 mb-1">troll_coins Available</p>
          <p className="text-2xl font-bold text-purple-300">
            {balance.toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-sm opacity-70 mb-1">Redemption Method</p>
          <div>
            <p className="text-xs text-green-400 mt-1">Visa eGift Card</p>
          </div>
        </div>

        {payoutWindowOpen && (
          <div className="rounded-lg border border-green-500/40 bg-green-900/20 px-3 py-2 text-xs text-green-200">
            Payouts are currently OPEN! (Every Friday)
          </div>
        )}

        {creditUsed > 0 && (
          <div className="rounded-lg border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-red-200 font-bold">
             ⚠️ You cannot request a payout while you have an outstanding Credit Card balance ({creditUsed.toLocaleString()} coins). Please pay off your balance first.
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-2">
            Select a Cashout tier ({TIERS.map(t => (t.coins/1000).toFixed(1) + 'k').join(', ')})
          </label>
          <input
            className="w-full mb-2 px-4 py-3 rounded-lg bg-zinc-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            type="number"
            min="12000"
            value={coins}
            onChange={(e) => setCoins(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="e.g. 12000"
          />
          <p className="text-sm opacity-80">
            Estimated payout: <span className="font-bold text-green-400">${grossUsd.toFixed(2)} USD</span>
          </p>
          {TIERS.some(t => t.coins === parsed) && (
            <div className="text-xs text-gray-400 mt-1">
              Fee: <span className="text-red-400">${FIXED_FEE_USD.toFixed(2)}</span> • Net: <span className="text-green-400">${netUsd.toFixed(2)}</span>
              {TIERS.find(t => t.coins === parsed)?.manualReview && (
                 <span className="block text-yellow-400 mt-1">⚠️ Requires Manual Review</span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={loading || !coins || !TIERS.some(t => t.coins === Number(coins)) || Number(coins) > balance || !payoutWindowOpen || creditUsed > 0}
          className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? "Submitting..." : "Submit Payout Request"}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

