import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RefundBody {
  sessionId: string;
  reason?: string;
}

async function getSupabase() {
  const mod = await import("@supabase/supabase-js");
  return mod;
}

async function authorizeUser(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("Missing auth header. Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));
    throw new Error("Missing authorization header");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error("Server configuration error");
  }

  const { createClient } = await getSupabase();
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) {
    throw new Error("No active session. Please sign in again.");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  return { user, supabaseAdmin };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as RefundBody;
    if (!body?.sessionId) {
      return new Response(JSON.stringify({ error: "Missing sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, supabaseAdmin } = await authorizeUser(req);

    const { data: session } = await supabaseAdmin
      .from("live_sessions")
      .select("id, user_id, allowed_quality, status, hd_paid, hd_refunded")
      .eq("id", body.sessionId)
      .maybeSingle();

    if (!session || session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.allowed_quality !== "HD_BOOST" || !session.hd_paid || session.hd_refunded) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.status === "live") {
      return new Response(JSON.stringify({ error: "Stream already live" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingRefund } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "HD_BOOST_REFUND")
      .eq("reference_id", body.sessionId)
      .maybeSingle();

    if (!existingRefund) {
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("troll_coins")
        .eq("id", user.id)
        .maybeSingle();

      const currentCoins = Number(profile?.troll_coins || 0);
      const refundAmount = 500;

      await supabaseAdmin
        .from("user_profiles")
        .update({ troll_coins: currentCoins + refundAmount })
        .eq("id", user.id);

      await supabaseAdmin
        .from("wallet_transactions")
        .insert({
          user_id: user.id,
          type: "HD_BOOST_REFUND",
          currency: "troll_coins",
          amount: refundAmount,
          reason: body.reason || "HD Boost refund",
          source: "go_live",
          reference_id: body.sessionId,
          metadata: { reason: body.reason || null }
        });
    }

    await supabaseAdmin
      .from("live_sessions")
      .update({ hd_refunded: true, refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", body.sessionId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
