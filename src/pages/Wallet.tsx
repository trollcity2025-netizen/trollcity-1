import React, { useEffect, useState } from "react";
import { useAuthStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Wallet as WalletIcon, Coins, DollarSign } from "lucide-react";

interface CoinTx {
  id: string;
  coins: number;
  usd_amount: string | number;
  source: string;
  external_id: string | null;
  payment_status: string | null;
  created_at: string;
}

export default function Wallet() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [txs, setTxs] = useState<CoinTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("coin_transactions")
        .select("id, coins, usd_amount, source, external_id, payment_status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (!error && data) {
        setTxs(data as any);
      }
      setLoading(false);
    };

    load();
  }, [user]);

  if (!user) {
    return (
      <div className="p-6 text-center text-white min-h-screen flex items-center justify-center">
        <div>Please log in to view your wallet.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto text-white min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <WalletIcon className="w-8 h-8 text-purple-400" />
        <h1 className="text-3xl font-bold">Wallet</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl bg-black/60 border border-purple-600 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-purple-400" />
            <div className="text-sm opacity-70">Paid Coins</div>
          </div>
          <div className="text-2xl font-bold text-purple-300">
            {profile?.paid_coin_balance?.toLocaleString() ?? 0}
          </div>
        </div>

        <div className="rounded-xl bg-black/60 border border-green-600 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-green-400" />
            <div className="text-sm opacity-70">Free Coins</div>
          </div>
          <div className="text-2xl font-bold text-green-300">
            {profile?.free_coin_balance?.toLocaleString() ?? 0}
          </div>
        </div>

        <div className="rounded-xl bg-black/60 border border-blue-600 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <div className="text-sm opacity-70">Payout Method</div>
          </div>
          <div className="text-md mt-1">
            {profile?.payout_paypal_email ? (
              <>
                PayPal: <span className="font-mono text-xs">{profile.payout_paypal_email}</span>
              </>
            ) : (
              <span className="text-red-400 text-sm">Not set</span>
            )}
          </div>
          {!profile?.payout_paypal_email && (
            <button
              onClick={() => navigate("/payouts/setup")}
              className="mt-2 text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded"
            >
              Set Up
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Recent Transactions</h2>
        <button
          onClick={() => navigate("/payouts/request")}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold"
        >
          Request Payout
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading transactions...</div>
      ) : txs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No transactions yet.</div>
      ) : (
        <div className="space-y-2">
          {txs.map((tx) => (
            <div
              key={tx.id}
              className="flex justify-between items-center rounded-lg bg-black/50 border border-purple-700/60 px-4 py-3"
            >
              <div>
                <div className="font-semibold text-purple-300">
                  +{tx.coins.toLocaleString()} coins
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {new Date(tx.created_at).toLocaleString()} · {tx.source} ·{" "}
                  {tx.payment_status || "completed"}
                </div>
                {tx.external_id && (
                  <div className="text-xs opacity-60 mt-1">
                    PayPal Tx: {tx.external_id.substring(0, 20)}...
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-bold text-green-400">
                  ${Number(tx.usd_amount || 0).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

