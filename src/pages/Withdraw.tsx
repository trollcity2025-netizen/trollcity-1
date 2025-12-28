import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";

export default function Withdraw() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    loadBalance();
  }, [user]);

  const loadBalance = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("user_profiles")
      .select("troll_coins, total_earned_coins")
      .eq("id", user.id)
      .single();

    // Use troll_coins for withdrawals (withdrawable coins)
    setBalance(data?.troll_coins || data?.total_earned_coins || 0);
  };

  const requestPayout = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const coinAmount = parseInt(amount, 10);

    if (coinAmount < 10000) {
      toast.error("Minimum withdrawal is 10,000 coins ($100)");
      return;
    }

    if (coinAmount > balance) {
      toast.error("You cannot withdraw more than your balance.");
      return;
    }

    // Calculate USD amount (assuming 100 coins = $1, so $0.01 per coin)
    const usdAmount = coinAmount * 0.01; // $0.01 per coin = $100 for 10,000 coins
    
    const { error } = await supabase.from("payout_requests").insert({
      user_id: user.id,
      coins_redeemed: coinAmount,
      cash_amount: usdAmount,
      status: "pending",
    });

    if (error) {
      console.error("Payout request error:", error);
      return toast.error("Error submitting request");
    }
    
    toast.success("Withdrawal request submitted!");
    setAmount("");
    loadBalance();
  };

  return (
    <div className="min-h-screen bg-[#0A0814] p-6">
      <div className="max-w-md mx-auto text-white">
        <h2 className="text-2xl font-bold mb-4">Withdraw Earnings</h2>

        <p className="mb-2">
          <strong>Your Balance:</strong> {balance.toLocaleString()} coins  
          (${(balance * 0.01).toFixed(2)})
        </p>

        <input
          type="number"
          className="w-full p-2 rounded bg-zinc-800 text-white placeholder-gray-400 mb-3 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Enter coin amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button
          onClick={requestPayout}
          className="bg-green-500 hover:bg-green-600 w-full mt-3 py-2 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!amount || parseInt(amount) < 10000 || parseInt(amount) > balance}
        >
          Request Withdrawal
        </button>
      </div>
    </div>
  );
}


