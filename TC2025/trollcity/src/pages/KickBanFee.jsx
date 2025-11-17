import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, DollarSign, AlertCircle, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getEarningsConfig, processSquarePayment } from "@/api/square";

export default function KickBanFeePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [feeType, setFeeType] = useState("kick_fee");
  const [amountUsd, setAmountUsd] = useState(5);
  const [broadcasterId, setBroadcasterId] = useState(null);
  const [squareReady, setSquareReady] = useState(false);
  const [squareInitError, setSquareInitError] = useState(null);
  const [squarePayments, setSquarePayments] = useState(null);
  const [squareCard, setSquareCard] = useState(null);
  const [squareLoading, setSquareLoading] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return profile;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["moderationSettingsForFees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_settings")
        .select("*")
        .eq("setting_key", "global_moderation")
        .limit(1);
      if (error) return [];
      return data || [];
    },
    staleTime: 60000,
  });

  useEffect(() => {
    const s = settings?.[0];
    if (s && typeof s === "object") {
      if (feeType === "kick_fee") {
        setAmountUsd(5);
      } else if (feeType === "do_not_kick_fee") {
        setAmountUsd(10); // $10 for Do Not Kick protection
      } else if (typeof s.ban_fee_usd === "number" && s.ban_fee_usd > 0 && feeType === "ban_fee") {
        setAmountUsd(s.ban_fee_usd);
      }
    }
  }, [settings, feeType]);

  useEffect(() => {
    let destroyed = false;
    async function setupSquare() {
      try {
        setSquareInitError(null);
        setSquareReady(false);
        const cfg = await getEarningsConfig();
        const appId = cfg?.square_application_id;
        const locationId = cfg?.square_location_id;
        if (!appId || !locationId || !cfg?.square_account_active) {
          setSquareInitError("Square is not configured by admin");
          return;
        }
        if (!window.Square) {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://web.squarecdn.com/v1/square.js";
            s.async = true;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Failed to load Square SDK"));
            document.head.appendChild(s);
          });
        }
        const payments = window.Square.payments(appId, locationId);
        if (destroyed) return;
        setSquarePayments(payments);
        const card = await payments.card();
        await card.attach("#kickban-square-card");
        if (destroyed) { try { card.destroy && card.destroy(); } catch {} return; }
        setSquareCard(card);
        setSquareReady(true);
      } catch (err) {
        setSquareInitError(err?.message || String(err));
      }
    }
    setupSquare();
    return () => {
      destroyed = true;
      try { if (squareCard && squareCard.destroy) squareCard.destroy(); } catch {}
      setSquareCard(null);
      setSquarePayments(null);
      setSquareReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) throw new Error("Not authenticated");
      const now = new Date().toISOString();
      throw new Error("This flow has moved to Square payments");
    },
    onSuccess: () => {
      qc.invalidateQueries(["manualPaymentRequests"]);
      toast.success("Fee submitted — awaiting admin review");
      navigate(createPageUrl("PaymentRequired"));
    },
    onError: (e) => toast.error(e?.message || "Failed to submit fee"),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) throw new Error("Not authenticated");
      if (!squareCard) throw new Error("Square card is not ready");
      const tokenize = await squareCard.tokenize();
      if (tokenize.status !== "OK" || !tokenize.token) {
        const errs = (tokenize.errors || []).map(e => e.message).join(", ");
        throw new Error(errs || "Failed to tokenize card");
      }
      const sourceId = tokenize.token;
      const amountCents = Math.round(Number(amountUsd || 0) * 100);
      let description = "Kick Fee Payment";
      let actionType = "kick_fee_paid";
      
      if (feeType === "ban_fee") {
        description = "Ban Appeal Fee Payment";
        actionType = "ban_fee_paid";
      } else if (feeType === "do_not_kick_fee") {
        description = "Do Not Kick Protection Fee";
        actionType = "do_not_kick_paid";
      }
      
      const result = await processSquarePayment({
        amount: amountCents,
        currency: "USD",
        sourceId,
        description,
        userId: currentUser.id,
        metadata: { idempotency_key: `${currentUser.id}-${Date.now()}-${amountCents}`, fee_type: feeType },
      });
      if (!result?.success) throw new Error("Square payment failed");
      
      const now = new Date().toISOString();
      
      // Handle 50/50 split for Do Not Kick protection
      if (feeType === "do_not_kick_fee" && amountUsd >= 10) {
        const adminShare = Math.floor(amountUsd * 0.5 * 100); // 50% to admin
        const broadcasterShare = amountCents - adminShare; // 50% to broadcaster
        
        try {
          // Record admin share
          await supabase.from("coin_transactions").insert({
            user_id: currentUser.id,
            amount: adminShare,
            transaction_type: "do_not_kick_admin_share",
            reference_id: result.paymentId || result.transactionId || "n/a",
            description: `Admin share of Do Not Kick protection fee`,
            created_at: now
          });
          
          // Record broadcaster share (if broadcaster ID is available)
          if (broadcasterId) {
            await supabase.from("coin_transactions").insert({
              user_id: broadcasterId,
              amount: broadcasterShare,
              transaction_type: "do_not_kick_broadcaster_share",
              reference_id: result.paymentId || result.transactionId || "n/a",
              description: `Broadcaster share of Do Not Kick protection fee`,
              created_at: now
            });
          }
        } catch (e) {
          console.error("Error recording split transactions:", e);
        }
      }
      
      try {
        await supabase.from("moderation_actions").insert({ 
          user_id: currentUser.id, 
          action: actionType, 
          target_type: "user", 
          target_id: currentUser.id, 
          created_date: now, 
          notes: `Paid $${Number(amountUsd).toFixed(2)} via Square; paymentId=${result.paymentId || result.transactionId || "n/a"}` 
        });
      } catch (_) {}
      
      try {
        await supabase.from("notifications").insert({ 
          user_id: null, 
          type: "admin_payment_review", 
          title: "Kick/Ban Fee Paid", 
          message: `User ${currentUser.username || currentUser.email} paid ${feeType} for $${Number(amountUsd).toFixed(2)} via Square`, 
          is_read: false, 
          created_date: now 
        });
      } catch (_) {}
      
      return result;
    },
    onSuccess: async () => {
      toast.success("Payment successful — admin will review shortly");
      setSquareLoading(false);
      await Promise.all([
        qc.invalidateQueries(["currentUser"]),
        qc.invalidateQueries(["moderationQueue"]),
      ]);
      navigate(createPageUrl("PaymentRequired"));
    },
    onError: (e) => {
      setSquareLoading(false);
      toast.error(e?.message || "Failed to process payment");
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-red-400" />
            <h1 className="text-xl font-bold text-white">Kick/Ban Fee Payment</h1>
          </div>
          <p className="text-gray-400 text-sm mb-4">Pay the required fee to restore access. Payments are processed securely via Square and reviewed by admins.</p>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-300 mb-2 block">Fee Type</label>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant={feeType === "kick_fee" ? "default" : "outline"} onClick={() => setFeeType("kick_fee")}>Kick Unblock Fee</Button>
                <Button type="button" variant={feeType === "do_not_kick_fee" ? "default" : "outline"} onClick={() => setFeeType("do_not_kick_fee")}>Do Not Kick Protection</Button>
                <Button type="button" variant={feeType === "ban_fee" ? "default" : "outline"} onClick={() => setFeeType("ban_fee")}>Ban Appeal Fee</Button>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-2 block">Amount (USD)</label>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                <Input type="number" value={amountUsd} onChange={(e) => setAmountUsd(Number(e.target.value || 0))} className="bg-[#0f0f16] border-[#2a2a3a] text-white" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {feeType === "kick_fee" && "Kick fee defaults to $5."}
                {feeType === "do_not_kick_fee" && "Do Not Kick protection fee is $10 (50% goes to broadcaster)."}
                {feeType === "ban_fee" && "Ban fee uses admin setting."}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-2 block">Card Payment</label>
              <div className="p-3 bg-[#0f0f16] border border-[#2a2a3a] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-400">Powered by Square Web Payments SDK</span>
                </div>
                {squareInitError ? (
                  <div className="text-red-400 text-sm">{squareInitError}</div>
                ) : (
                  <div id="kickban-square-card" className="min-h-[48px]" />
                )}
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-200 text-xs">Submissions are reviewed within 1–3 business days.</span>
            </div>

            <div className="flex gap-3">
              <Button type="button" onClick={() => { setSquareLoading(true); payMutation.mutate(); }} disabled={!squareReady || payMutation.isPending || squareLoading} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                {squareLoading || payMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Pay with Square</>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(createPageUrl("PaymentRequired"))} className="flex-1">Back</Button>
            </div>
          </div>
        </Card>

        <div className="mt-4 text-center">
          <Badge className="bg-purple-600">Admin Review</Badge>
        </div>
      </div>
    </main>
  );
}

