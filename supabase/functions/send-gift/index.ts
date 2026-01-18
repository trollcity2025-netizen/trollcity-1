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

const GIFT_COST = 5;
const ROYALTY_RATE = 0.1;

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

    const senderId = authData.user.id;
    const body = await req.json().catch(() => null);

    if (!body || !body.giftId || !body.streamId) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const giftId = body.giftId as string;
    const streamId = body.streamId as string;
    const recipientId = body.recipientId as string | undefined;

    const { data: gift, error: giftError } = await supabaseAdmin
      .from("user_gifts")
      .select("id, creator_id, status")
      .eq("id", giftId)
      .maybeSingle();

    if (giftError || !gift || gift.status !== "approved") {
      return new Response(JSON.stringify({ error: "Gift not approved" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (gift.creator_id === senderId) {
      return new Response(JSON.stringify({ error: "Creator cannot send own gift" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("troll_coins")
      .eq("id", senderId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const balance = profile.troll_coins || 0;
    if (balance < GIFT_COST) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const royalty = GIFT_COST * ROYALTY_RATE;

    const { data: rpcBalance, error: deductError } = await supabaseAdmin.rpc(
      "deduct_user_troll_coins",
      {
        p_user_id: senderId,
        p_amount: GIFT_COST.toString(),
        p_coin_type: "troll_coins",
      },
    );

    if (deductError) {
      return new Response(JSON.stringify({ error: "Failed to deduct coins" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error: ledgerError } = await supabaseAdmin
      .from("coin_ledger")
      .insert({
        user_id: gift.creator_id,
        delta: royalty,
        reason: "trollg_royalty",
        ref_id: giftId,
      });

    if (ledgerError) {
      console.error("Failed to write coin_ledger", ledgerError);
    }

    const { error: sendError } = await supabaseAdmin
      .from("gift_sends")
      .insert({
        gift_id: giftId,
        sender_id: senderId,
        recipient_id: recipientId || null,
        stream_id: streamId,
        coins_spent: GIFT_COST,
        creator_royalty: royalty,
      });

    if (sendError) {
      console.error("Failed to log gift_sends", sendError);
      return new Response(JSON.stringify({ error: "Failed to log gift send" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, newBalance: rpcBalance }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send_gift error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

