import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
console.log("✅ LIVEKIT TOKEN DEPLOY MARKER v111 - " + new Date().toISOString());

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const OFFICER_ROLES = new Set(["admin", "lead_troll_officer", "troll_officer"]);

interface AuthorizedProfile {
  id: string;
  username: string;
  role: string;
  avatar_url?: string | null;
  is_broadcaster?: boolean;
  is_admin?: boolean;
  is_lead_officer?: boolean;
  is_troll_officer?: boolean;
}

// ✅ Lazy imports so OPTIONS is instant
async function getSupabase() {
  const mod = await import("@supabase/supabase-js");
  return mod;
}

async function getLivekit() {
  // Pin version to reduce surprises
  const mod = await import("livekit-server-sdk");
  return mod;
}

async function authorizeUser(req: Request): Promise<AuthorizedProfile> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Missing auth token");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error("Supabase not configured");
  }

  const { createClient } = await getSupabase();

  // Use anon + user JWT to validate session
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw new Error("Unable to verify session");

  // Use service role to read profile without RLS headaches
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select("id, username, role, avatar_url, is_broadcaster, is_admin, is_lead_officer, is_troll_officer")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) throw new Error("Profile not found");

  return profile as AuthorizedProfile;
}

serve(async (req: Request) => {
  // ✅ MUST be instant for browser preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const t0 = performance.now();

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = await authorizeUser(req);

    const params =
      req.method === "POST"
        ? await req.json()
        : Object.fromEntries(new URL(req.url).searchParams);

    const room = params.room || params.roomName;
    const identity = params.identity || profile.id;
    const allowPublish = params.allowPublish === true || params.allowPublish === "true";
    const level = params.level;

    if (!room) {
      return new Response(JSON.stringify({ error: "Missing room" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const livekitUrl = Deno.env.get("LIVEKIT_URL"); // or LIVEKIT_URL if you prefer

    if (!apiKey || !apiSecret || !livekitUrl) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedRole = (profile.role || "").toLowerCase();
    const hasOfficerRole =
      OFFICER_ROLES.has(normalizedRole) ||
      Boolean(profile.is_admin) ||
      Boolean(profile.is_lead_officer) ||
      Boolean(profile.is_troll_officer);

    const isBroadcaster = Boolean(profile.is_broadcaster);
    const canPublish = allowPublish && (hasOfficerRole || isBroadcaster);

    const metadata = {
      user_id: profile.id,
      username: profile.username,
      role: profile.role,
      avatar_url: profile.avatar_url,
      level: Number(level ?? 1),
    };

    const { AccessToken, TrackSource } = await getLivekit();

    const token = new AccessToken(apiKey, apiSecret, {
      identity: String(identity),
      name: profile.username,
      ttl: 60 * 60,
      metadata: JSON.stringify(metadata),
    });

    token.addGrant({
      room: String(room),
      roomJoin: true,
      canSubscribe: true,
      canPublish,
      canPublishData: canPublish,
      canUpdateOwnMetadata: true,
      canPublishSources: canPublish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
    });

    const jwt = await token.toJwt();

    const ms = Math.round(performance.now() - t0);
    console.log(`[livekit-token] ok room=${room} user=${profile.id} publish=${canPublish} ${ms}ms`);

    return new Response(
      JSON.stringify({
        token: jwt,
        livekitUrl,
        url: livekitUrl,
        room,
        identity: String(identity),
        allowPublish: canPublish,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const ms = Math.round(performance.now() - t0);
    console.error("[livekit-token] error", err?.message || err, `${ms}ms`);

    // ✅ Always return CORS headers even on failure
    const status = String(err?.message || "").includes("Unauthorized") ? 403 : 500;
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
