import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TROLLG_FEE = 10000;
const MIN_LEVEL = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, token, {
      global: { headers: { Authorization: authHeader } },
    } as any);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("level, troll_coins")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const level = profile.level || 0;
    if (level < MIN_LEVEL) {
      return new Response(JSON.stringify({ error: "Level too low" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const balance = profile.troll_coins || 0;
    if (balance < TROLLG_FEE) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: existingApp } = await supabaseAdmin
      .from("trollg_applications")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingApp) {
      return new Response(JSON.stringify({ success: true, alreadyPaid: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: rpcResult, error: deductError } = await supabaseAdmin.rpc(
      "deduct_user_troll_coins",
      {
        p_user_id: userId,
        p_amount: TROLLG_FEE.toString(),
        p_coin_type: "troll_coins",
      },
    );

    if (deductError) {
      return new Response(JSON.stringify({ error: "Failed to deduct coins" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error: adminLedgerError } = await supabaseAdmin
      .from("admin_pool_ledger")
      .insert({
        amount: TROLLG_FEE,
        reason: "trollg_fee",
        ref_user_id: userId,
      });

    if (adminLedgerError) {
      console.error("Failed to write admin_pool_ledger", adminLedgerError);
    }

    const { error: appError } = await supabaseAdmin
      .from("trollg_applications")
      .insert({
        user_id: userId,
        level_at_purchase: level,
        fee_amount: TROLLG_FEE,
        status: "paid",
      });

    if (appError) {
      console.error("Failed to insert trollg_applications", appError);
      return new Response(JSON.stringify({ error: "Failed to unlock TrollG" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error: eventError } = await supabaseAdmin
      .from("vote_events")
      .insert({
        event_type: "trollg_fee_paid",
        user_id: userId,
        gift_id: null,
        is_active: true,
      });

    if (eventError) {
      console.error("Failed to create vote event", eventError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("pay_trollg_fee error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

