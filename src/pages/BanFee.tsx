import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Scale, Home } from "lucide-react";
import { useAuthStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { EDGE_URL } from "../lib/config";

export default function BanFee() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, logout } = useAuthStore();
  const [banDays, setBanDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCashAppInfo, setShowCashAppInfo] = useState(false);

  const banFee = 3000;
  const usernamePrefix = String(
    profile?.username || user?.email?.split("@")[0] || "user"
  )
    .slice(0, 6)
    .toUpperCase();
  const suggestedNote = `${usernamePrefix}-BAN-APPEAL`;

  useEffect(() => {
    const localBanDays = localStorage.getItem("banDays");
    if (localBanDays) {
      const parsed = parseInt(localBanDays);
      if (!Number.isNaN(parsed)) {
        setBanDays(parsed);
      }
    }
  }, []);

  const handlePayForAppeal = async () => {
    if (!user || !profile) {
      toast.error("You must be logged in");
      navigate("/auth");
      return;
    }

    if ((profile.troll_coins || 0) < banFee) {
      toast.error("Not enough troll_coins to restore account");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("pay_ban_restoration_fee", {
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Ban restoration fee paid. Account can be restored.");
        localStorage.removeItem("banDays");
        refreshProfile?.();
        navigate("/troll-court", { replace: true });
      } else {
        toast.error(data?.error || "Failed to pay ban restoration fee");
      }
    } catch (err: any) {
      console.error("Error paying ban restoration fee:", err);
      toast.error(err?.message || "Failed to pay ban restoration fee");
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithCashApp = () => {
    setShowCashAppInfo(true);
    toast.info("Follow the Cash App instructions below to complete your appeal fee.");
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

      localStorage.removeItem("banDays");
      localStorage.removeItem("kickCount");

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
            <AlertCircle size={48} className="text-red-500" />
          </div>

          <h1 className="text-3xl font-black text-center mb-4 text-red-400">
            Account Banned
          </h1>

          <p className="text-center text-gray-300 mb-6">
            Your account has been banned. You can appeal this decision in Troll Court.
          </p>

          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-red-500/30">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Ban Duration:</span>
              <span className="font-bold text-red-400">{banDays} Days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Appeal Fee:</span>
              <span className="font-bold text-yellow-400">{banFee} 🪙</span>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Pay to join Troll Court and appeal your ban
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handlePayForAppeal}
              disabled={loading || deleteLoading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition flex items-center justify-center gap-2 purple-neon"
            >
              <Scale size={18} />
              {loading ? "Processing..." : `Appeal in Troll Court (${banFee} 🪙)`}
            </button>

            <button
              onClick={handlePayWithCashApp}
              disabled={deleteLoading}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition flex items-center justify-center gap-2 text-gray-300"
            >
              <Scale size={18} />
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

            <div className="flex justify-center">
              <button
                onClick={() => navigate("/")}
                disabled={deleteLoading}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition flex items-center justify-center gap-2 text-gray-300"
              >
                <Home size={18} />
                Return Home
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            During your ban, you can still access Troll Court to appeal. Your case will be reviewed by officers.
          </p>
        </div>
      </div>
    </div>
  );
}
