import React, { useState } from "react";
import { useAuthStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { DollarSign, ArrowRight } from "lucide-react";

const COINS_PER_DOLLAR = 100; // keep in sync with backend

export default function PayoutRequest() {
  const { user, profile, refreshProfile } = useAuthStore() as any;
  const [coins, setCoins] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <div className="p-6 text-center text-white min-h-screen flex items-center justify-center">
        <div>Please log in to request a payout.</div>
      </div>
    );
  }

  const balance = profile?.paid_coin_balance ?? 0;
  const parsed = Number(coins || "0");
  const usdEstimate =
    parsed && parsed > 0 ? (parsed / COINS_PER_DOLLAR).toFixed(2) : "0.00";

  const submit = async () => {
    try {
      setLoading(true);
      const num = Number(coins);
      
      if (!num || num <= 0) {
        toast.error("Enter a valid coin amount.");
        return;
      }
      
      if (num < 10000) {
        toast.error("Minimum payout is 10,000 coins ($100).");
        return;
      }
      
      if (num > balance) {
        toast.error("You don't have that many paid coins.");
        return;
      }
      
      if (!profile?.payout_paypal_email) {
        toast.error("You must set a PayPal payout email first.");
        return;
      }

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("No auth token");

      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';

      const res = await fetch(
        `${edgeFunctionsUrl}/paypal-payout-request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ coinsRequested: num })
        }
      );
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Payout request failed:", errorText);
        throw new Error("Failed to create payout request");
      }

      const json = await res.json();
      console.log(json);
      
      if (refreshProfile) await refreshProfile();
      
      toast.success("Payout request created. Admin will review it.");
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
          <p className="text-sm opacity-70 mb-1">Paid Coins Available</p>
          <p className="text-2xl font-bold text-purple-300">
            {balance.toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-sm opacity-70 mb-1">Payout Method</p>
          {profile?.payout_paypal_email ? (
            <p className="font-mono text-sm">{profile.payout_paypal_email}</p>
          ) : (
            <div>
              <span className="text-red-400 text-sm">Not set</span>
              <button
                onClick={() => window.location.href = "/payouts/setup"}
                className="ml-2 text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded"
              >
                Set Up
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            Coins to cash out (Minimum: 10,000 coins = $100)
          </label>
          <input
            className="w-full mb-2 px-4 py-3 rounded-lg bg-zinc-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            type="number"
            min="10000"
            value={coins}
            onChange={(e) => setCoins(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="e.g. 10000"
          />
          <p className="text-sm opacity-80">
            Estimated payout: <span className="font-bold text-green-400">${usdEstimate} USD</span>
          </p>
        </div>

        <button
          onClick={submit}
          disabled={loading || !coins || Number(coins) < 10000 || Number(coins) > balance}
          className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? "Submitting..." : "Submit Payout Request"}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

