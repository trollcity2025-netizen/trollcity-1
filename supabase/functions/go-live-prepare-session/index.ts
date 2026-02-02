// Use Deno.serve for Edge-safe runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Quality = "STANDARD" | "HD_BOOST" | "HIGHEST";

const QUALITY_CONFIG: Record<Quality, { width: number; height: number; frameRate: number; bitrate: number; maxBitrate: number }>= {
  STANDARD: { width: 960, height: 540, frameRate: 24, bitrate: 800_000, maxBitrate: 900_000 },
  HD_BOOST: { width: 1280, height: 720, frameRate: 30, bitrate: 2_000_000, maxBitrate: 2_500_000 },
  HIGHEST: { width: 1920, height: 1080, frameRate: 30, bitrate: 4_000_000, maxBitrate: 5_000_000 },
};

interface PrepareBody {
  requestedQuality?: Quality;
  idempotencyKey?: string;
  sessionId?: string;
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

function isPrivileged(profile: any) {
  const role = String(profile?.role || "").toLowerCase();
  if (role.includes("admin") || role.includes("secretary") || role.includes("officer")) return true;
  if (profile?.is_admin || profile?.is_lead_officer || profile?.is_troll_officer) return true;
  return false;
}

Deno.serve(async (req) => {
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
    const body = (await req.json()) as PrepareBody;
    const requestedQuality = body?.requestedQuality || "STANDARD";
    const idempotencyKey = body?.idempotencyKey || null;
    const providedSessionId = body?.sessionId || null;

    const { user, supabaseAdmin } = await authorizeUser(req);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, username, role, is_admin, is_lead_officer, is_troll_officer, troll_coins")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error("Unable to load user profile");
    }

    const privileged = isPrivileged(profile);
    const cost = 500;
    let allowedQuality: Quality = privileged ? "HIGHEST" : requestedQuality === "HD_BOOST" ? "HD_BOOST" : "STANDARD";

    let sessionRow: any = null;
    if (idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from("live_sessions")
        .select("id, allowed_quality, cost, hd_paid, status, idempotency_key")
        .eq("user_id", user.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      sessionRow = existing || null;
      if (sessionRow?.allowed_quality) {
        allowedQuality = sessionRow.allowed_quality as Quality;
      }
    }

    const sessionId = sessionRow?.id || providedSessionId || crypto.randomUUID();

    if (!sessionRow) {
      const insertPayload = {
        id: sessionId,
        user_id: user.id,
        requested_quality: requestedQuality,
        allowed_quality: allowedQuality,
        status: "created",
        cost: allowedQuality === "HD_BOOST" && !privileged ? cost : 0,
        hd_paid: false,
        room_name: sessionId,
        idempotency_key: idempotencyKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("live_sessions")
        .insert(insertPayload)
        .select("id, allowed_quality, cost, hd_paid")
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      sessionRow = inserted;
    }

    let hdPaid = Boolean(sessionRow?.hd_paid);

    if (!privileged && allowedQuality === "HD_BOOST") {
      if (!hdPaid) {
        const { data: existingCharge } = await supabaseAdmin
          .from("wallet_transactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "HD_BOOST_PURCHASE")
          .eq("reference_id", sessionId)
          .maybeSingle();

        if (!existingCharge) {
          const { data: spendResult, error: spendError } = await supabaseAdmin.rpc(
            "troll_bank_spend_coins_secure",
            {
              p_user_id: user.id,
              p_amount: cost,
              p_source: "go_live",
              p_reason: "HD Boost session purchase",
              p_ref_id: sessionId,
              p_metadata: { requested_quality: requestedQuality }
            }
          );

          if (spendError || !spendResult) {
            console.error("Spend error:", spendError);
            return new Response(JSON.stringify({ error: "INSUFFICIENT_COINS" }), {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Legacy transaction logging removed - Troll Bank coin_ledger is now the source of truth.
          /* 
          const { error: txError } = await supabaseAdmin
            .from("wallet_transactions")
            .insert({
              user_id: user.id,
              type: "HD_BOOST_PURCHASE",
              currency: "troll_coins",
              amount: -cost,
              reason: "HD Boost session purchase",
              source: "go_live",
              reference_id: sessionId,
              idempotency_key: idempotencyKey,
              metadata: { requested_quality: requestedQuality }
            });

          if (txError) {
             console.error("Wallet transaction insert error:", txError);
          }
          */
        }

        await supabaseAdmin
          .from("live_sessions")
          .update({ hd_paid: true, allowed_quality: "HD_BOOST", cost, updated_at: new Date().toISOString() })
          .eq("id", sessionId);

        hdPaid = true;
      }
    } else {
      await supabaseAdmin
        .from("live_sessions")
        .update({ allowed_quality: allowedQuality, cost: 0, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }

    const qualityConfig = QUALITY_CONFIG[allowedQuality];
    const publishConfig = {
      quality: allowedQuality,
      video: {
        width: qualityConfig.width,
        height: qualityConfig.height,
        frameRate: qualityConfig.frameRate,
        bitrate: qualityConfig.bitrate,
        maxBitrate: qualityConfig.maxBitrate,
        simulcast: true,
      },
      audio: {
        bitrate: 96_000,
      },
      captureConstraints: {
        width: { ideal: qualityConfig.width },
        height: { ideal: qualityConfig.height },
        frameRate: { ideal: qualityConfig.frameRate },
        facingMode: allowedQuality === "HIGHEST" ? "environment" : "user",
      },
    };

    const livekitUrl = Deno.env.get("LIVEKIT_URL") || null;
    const livekitToken = null; // Edge-safe placeholder; generate via WebCrypto or external service later

    return new Response(
      JSON.stringify({
        sessionId,
        allowedQuality,
        paymentRequired: allowedQuality === "HD_BOOST" && !privileged,
        cost: allowedQuality === "HD_BOOST" && !privileged ? cost : 0,
        hdPaid,
        livekitToken,
        publishConfig,
        livekitUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
