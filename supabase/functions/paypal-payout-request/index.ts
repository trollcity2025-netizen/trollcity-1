import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS headers
const cors = {
  "Access-Control-Allow-Origin": "https://trollcity.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// how many coins = $1 for payout
const COINS_PER_DOLLAR = 100; // adjust as needed

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return new Response("Unauthorized", { status: 401, headers: cors });

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      token
    );
    if (userErr || !userData.user) {
      console.error("Auth error", userErr);
      return new Response("Unauthorized", { status: 401, headers: cors });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const coinsRequested = Number(body.coinsRequested);
    const overrideEmail = body.payoutAddress as string | undefined;

    if (!coinsRequested || coinsRequested <= 0) {
      return new Response("Invalid coins amount", { status: 400, headers: cors });
    }

    const { data: profile, error: profErr } = await supabase
      .from("user_profiles")
      .select("paid_coin_balance, payout_paypal_email")
      .eq("id", userId)
      .single();

    if (profErr || !profile) {
      console.error("Profile error", profErr);
      return new Response("Profile not found", { status: 404, headers: cors });
    }

    const payoutEmail = overrideEmail || profile.payout_paypal_email;
    if (!payoutEmail) {
      return new Response("Missing PayPal payout email", { status: 400, headers: cors });
    }

    if (profile.paid_coin_balance < coinsRequested) {
      return new Response("Insufficient paid coins", { status: 400, headers: cors });
    }

    const usdEstimate = coinsRequested / COINS_PER_DOLLAR;

    // Deduct coins
    const { error: balErr } = await supabase
      .from("user_profiles")
      .update({
        paid_coin_balance: profile.paid_coin_balance - coinsRequested
      })
      .eq("id", userId);

    if (balErr) {
      console.error("Balance update error", balErr);
      return new Response("Failed to update balance", { status: 500, headers: cors });
    }

    const { data: payout, error: payoutErr } = await supabase
      .from("payout_requests")
      .insert({
        user_id: userId,
        coins_requested: coinsRequested,
        usd_estimate: usdEstimate.toFixed(2),
        payout_method: "paypal",
        payout_address: payoutEmail,
        status: "pending"
      })
      .select("*")
      .single();

    if (payoutErr) {
      console.error("Insert payout error", payoutErr);
      return new Response("Failed to create payout request", { status: 500, headers: cors });
    }

    return new Response(JSON.stringify({ success: true, payout }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500, headers: cors });
  }
});
