import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";

export default function CoinsComplete() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuthStore() as any;
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    "pending"
  );
  const [message, setMessage] = useState<string>("Finishing your purchase...");

  useEffect(() => {
    const orderId = search.get("token") || search.get("orderId") || search.get("PayerID");
    if (!orderId) {
      setStatus("error");
      setMessage("Missing PayPal order ID.");
      return;
    }

    const run = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error("No auth token");

        const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
          'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';

        const res = await fetch(
          `${edgeFunctionsUrl}/paypal-capture-order`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ orderId })
          }
        );
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Capture failed:", errorText);
          throw new Error("Capture failed");
        }

        const json = await res.json();
        setStatus("success");
        setMessage(`Purchase complete! +${json.coinsAdded?.toLocaleString() || 0} coins added to your account.`);
        toast.success(`+${json.coinsAdded?.toLocaleString() || 0} coins added!`);
        
        if (refreshProfile) await refreshProfile();
      } catch (e: any) {
        console.error(e);
        setStatus("error");
        setMessage("There was a problem finalizing your purchase. Please contact support if coins were not added.");
        toast.error("Payment processing error");
      }
    };

    run();
  }, [search, refreshProfile]);

  return (
    <div className="p-6 max-w-xl mx-auto text-center text-white min-h-screen flex items-center justify-center">
      <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-3">Coin Purchase</h1>
        <p className="mb-6">{message}</p>
        {status === "pending" && (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
        )}
        {status !== "pending" && (
          <button
            onClick={() => navigate("/coins")}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors"
          >
            {status === "success" ? "Back to Store" : "Try Again"}
          </button>
        )}
      </div>
    </div>
  );
}
