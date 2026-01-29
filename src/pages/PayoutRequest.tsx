import React, { useState } from "react";
import { useAuthStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { DollarSign, ArrowRight } from "lucide-react";
import { isPayoutWindowOpen, PAYOUT_WINDOW_LABEL } from "../lib/payoutWindow";

const TIERS = [
  { coins: 12000, usd: 25 },
  { coins: 30000, usd: 70 },
  { coins: 60000, usd: 150 },
  { coins: 120000, usd: 325 },
] as const;
const FIXED_FEE_USD = 3;

function getRateForCoins(coins: number) {
  if (coins >= 120000) return 325 / 120000;
  if (coins >= 60000) return 150 / 60000;
  if (coins >= 30000) return 70 / 30000;
  if (coins >= 12000) return 25 / 12000;
  return 0;
}

export default function PayoutRequest() {
  const { user, profile, refreshProfile } = useAuthStore() as any;
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
      
      if (![12000, 30000, 60000, 120000].includes(num)) {
        toast.error("Select a valid PayPal tier: 12k, 30k, 60k, 120k.");
        return;
      }
      
      if (num > balance) {
        toast.error("You don't have that many troll_coins.");
        return;
      }
      const tier = TIERS.find(t => t.coins === num);
      if (!tier) {
        toast.error("Select a valid PayPal tier: 12k, 30k, 60k, 120k.");
        return;
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

        {!payoutWindowOpen && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-200">
            {PAYOUT_WINDOW_LABEL}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-2">
            Select a Cashout tier (12k, 30k, 60k, 120k)
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
          {[12000,30000,60000,120000].includes(parsed) && (
            <div className="text-xs text-gray-400 mt-1">
              Fee: <span className="text-red-400">${FIXED_FEE_USD.toFixed(2)}</span> • Net: <span className="text-green-400">${netUsd.toFixed(2)}</span>
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={loading || !coins || ![12000,30000,60000,120000].includes(Number(coins)) || Number(coins) > balance || !payoutWindowOpen}
          className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? "Submitting..." : "Submit Payout Request"}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

