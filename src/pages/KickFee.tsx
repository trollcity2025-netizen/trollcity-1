import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CreditCard, Home } from "lucide-react";
import { useAuthStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { EDGE_URL } from "../lib/config";

export default function KickFee() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, logout } = useAuthStore();
  const [kickCount, setKickCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCashAppInfo, setShowCashAppInfo] = useState(false);

  const reinstatementFee = 500;
  const usernamePrefix = String(
    profile?.username || user?.email?.split("@")[0] || "user"
  )
    .slice(0, 6)
    .toUpperCase();
  const suggestedNote = `${usernamePrefix}-KICK-REENTRY`;

  useEffect(() => {
    if (profile?.kick_count != null) {
      setKickCount(profile.kick_count);
      return;
    }

    const localKick = localStorage.getItem("kickCount");
    if (localKick) {
      const parsed = parseInt(localKick);
      if (!Number.isNaN(parsed)) {
        setKickCount(parsed);
      }
    }
  }, [profile]);

  const handlePayWithCoins = async () => {
    if (!user || !profile) {
      toast.error("You must be logged in");
      navigate("/auth");
      return;
    }

    if ((profile.troll_coins || 0) < reinstatementFee) {
      toast.error("Not enough troll_coins to pay re-entry fee");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("pay_kick_reentry_fee", {
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Re-entry fee paid. Access restored.");
        localStorage.removeItem("kickCount");
        refreshProfile?.();
        navigate("/", { replace: true });
      } else {
        toast.error(data?.error || "Failed to pay re-entry fee");
      }
    } catch (err: any) {
      console.error("Error paying re-entry fee:", err);
      toast.error(err?.message || "Failed to pay re-entry fee");
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithCashApp = () => {
    setShowCashAppInfo(true);
    toast.info("Follow the Cash App instructions below to complete your re-entry fee.");
  };

  const handleDeleteAccountAndLogout = async () => {
    if (!user) {
      toast.error("You must be logged in");
      navigate("/auth");
      return;
    }

    const confirmed = window.confirm(
      "This will permanently delete your Troll City account and all progress. This cannot be undone. Continue?"
    );
    if (!confirmed) return;

    setDeleteLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(`${EDGE_URL}/auth/delete-account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || body?.error || body?.success === false) {
        const message = body?.error || "Failed to delete account";
        toast.error(message);
        return;
      }

      localStorage.removeItem("kickCount");
      localStorage.removeItem("banDays");

      toast.success("Account deleted. Logging out.");
      await logout();
      navigate("/auth", { replace: true });
    } catch (err: any) {
      console.error("Error deleting account:", err);
      toast.error(err?.message || "Failed to delete account");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white flex items-center justify-center p-4">

      <div className="max-w-md w-full">
        <div className="bg-gray-900/80 rounded-xl p-8 purple-neon">
          <div className="flex items-center justify-center mb-6">
            <AlertCircle size={48} className="text-red-400" />
          </div>

          <h1 className="text-3xl font-black text-center mb-4 text-red-400">
            Stream Access Suspended
          </h1>

          <p className="text-center text-gray-300 mb-6">
            You were kicked from a broadcast. Pay the reinstatement fee to rejoin streams.
          </p>

          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-red-500/30">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Kicks on Record:</span>
              <span className="font-bold text-red-400">{kickCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Reinstatement Fee:</span>
              <span className="font-bold text-yellow-400">{reinstatementFee} 🪙</span>
            </div>
          </div>

          {kickCount >= 3 && (
            <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-4 mb-6">
              <p className="text-orange-300 font-bold text-sm">
                ⚠️ Warning: {3 - kickCount} more kicks will result in IP ban
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handlePayWithCoins}
              disabled={loading || deleteLoading}
              className="w-full py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 rounded-lg font-bold transition flex items-center justify-center gap-2"
            >
              💰 {loading ? "Processing..." : `Pay ${reinstatementFee} Coins`}
            </button>

            <button
              onClick={handlePayWithCashApp}
              disabled={deleteLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-lg font-bold transition flex items-center justify-center gap-2"
            >
              <CreditCard size={18} />
              Pay via Cash App (manual)
            </button>

            {showCashAppInfo && (
              <div className="w-full py-3 px-4 bg-blue-950/60 border border-blue-500/40 rounded-lg text-sm text-blue-100 space-y-2">
                <div className="font-semibold">Manual Cash App payment</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Send payment to <span className="font-mono font-semibold">$trollcity95</span>
                  </li>
                  <li>
                    In the Cash App note include:{" "}
                    <span className="font-mono">{suggestedNote}</span>
                  </li>
                  <li>
                    Keep your Cash App receipt so support or Troll Court can verify your payment.
                  </li>
                </ul>
              </div>
            )}

            <button
              onClick={handleDeleteAccountAndLogout}
              disabled={deleteLoading || loading}
              className="w-full py-3 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 rounded-lg font-bold transition flex items-center justify-center gap-2 text-red-50"
            >
              {deleteLoading ? "Deleting account..." : "Log out and delete account"}
            </button>

            <button
              onClick={() => navigate("/")}
              disabled={deleteLoading}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition flex items-center justify-center gap-2 text-gray-300"
            >
              <Home size={18} />
              Return Home
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            Repeated offenses may result in ban or IP ban. You can appeal penalties in Troll Court.
          </p>
        </div>
      </div>

      {showCoinStore && (
        <CoinStoreModal
          onClose={() => setShowCoinStore(false)}
          onPurchase={() => {
            refreshProfile?.();
            // Don't close immediately, let them buy more if they want? 
            // Or close it? Usually keep open or user closes.
          }}
        />
      )}
    </div>
  );
}
