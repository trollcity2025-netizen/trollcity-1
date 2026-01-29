import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

// --- SupportTicketButton: Sends a support ticket to admin notifications ---
function SupportTicketButton() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { user } = (window as unknown as { __authStore?: { getState?: () => { user?: { id: string; username: string } } } }).__authStore?.getState?.() || {};

  const handleSupport = async () => {
    if (!user?.id) {
      toast.error("Please sign in to send a support ticket.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/support/coin-missing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, username: user.username, reason: "PayPal coins not credited after purchase" })
      });
      if (!res.ok) throw new Error("Failed to send support ticket");
      setSent(true);
      toast.success("Support ticket sent! Admin will review your payment.");
    } catch (err) {
      toast.error(err.message || "Failed to send support ticket");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return <div className="text-green-400 font-semibold">Support ticket sent! Please allow time for admin review.</div>;
  }
  return (
    <button
      onClick={handleSupport}
      disabled={loading}
      className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-500 text-black font-bold transition-colors disabled:opacity-60"
    >
      {loading ? "Sending..." : "Click here to notify admin"}
    </button>
  );
}

export default function CoinsComplete() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    "pending"
  );
  const [message, setMessage] = useState<string>("Finishing your purchase...");

  useEffect(() => {
    const canceled = search.get("canceled");
    const success = search.get("success");

    if (canceled) {
      setStatus("error");
      setMessage("Payment was cancelled.");
      toast.info("Payment cancelled");
      return;
    }

    if (success) {
      setStatus("success");
      setMessage("Payment successful. Your wallet will update shortly.");
      toast.success("Payment successful!");
      return;
    }

    setStatus("pending");
    setMessage("Waiting for payment confirmation...");
  }, [search]);

  return (
    <div className="p-6 max-w-xl mx-auto text-center text-white min-h-screen flex items-center justify-center">
      <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-3">Coin Purchase</h1>
        <p className="mb-6">{message}</p>
        {status === "pending" && (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
        )}
        {status !== "pending" && (
          <>
            <button
              onClick={() => navigate("/coins")}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors mb-4"
            >
              {status === "success" ? "Back to Store" : "Try Again"}
            </button>
            <div className="mt-6 bg-yellow-900/30 border border-yellow-600/40 rounded-lg p-4 text-yellow-200 text-sm">
              <div className="font-bold mb-2">Coins not added?</div>
              <div className="mb-3">If your coins do not appear within a few minutes after purchase, click below to notify support. An admin will verify your payment and manually credit your account if needed.</div>
              <SupportTicketButton />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
