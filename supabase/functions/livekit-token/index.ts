import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("✅ LIVEKIT TOKEN DEPLOY MARKER v113 - " + new Date().toISOString());

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

interface TokenRequestParams {
  room?: string;
  roomName?: string;
  identity?: string;
  allowPublish?: boolean | string;
  level?: string | number;
  role?: string;
}

// ✅ Lazy imports so OPTIONS is instant
async function getSupabase() {
  const mod = await import("@supabase/supabase-js");
  return mod;
}

async function getLivekit() {
  const mod = await import("livekit-server-sdk");
  return mod;
}

async function authorizeUser(req: Request): Promise<AuthorizedProfile> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    console.error("[authorizeUser] Missing or invalid authorization header");
    throw new Error("Missing authorization header");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error("[authorizeUser] Missing Supabase environment variables");
    throw new Error("Server configuration error");
  }

  const { createClient } = await getSupabase();

  // Use anon + user JWT to validate session
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  console.log("[authorizeUser] Validating JWT...");

  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

  if (userError || !user) {
    console.error("[authorizeUser] User validation error:", userError?.message);
    throw new Error("No active session. Please sign in again.");
  }

  console.log("[authorizeUser] JWT validated for user:", user.id);

  // Use service role to read profile without RLS headaches
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select("id, username, role, avatar_url, is_broadcaster, is_admin, is_lead_officer, is_troll_officer")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("[authorizeUser] Profile fetch error:", profileError.message);
    throw new Error("Unable to load user profile");
  }
  
  if (!profile) {
    console.error("[authorizeUser] No profile found for user:", user.id);
    throw new Error("User profile not found");
  }

  console.log("[authorizeUser] Profile loaded for user:", profile.username);
  return profile as AuthorizedProfile;
}

serve(async (req: Request) => {
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

    // Parse params first to determine intent
    const params: TokenRequestParams =
      req.method === "POST"
        ? await req.json() as TokenRequestParams
        : Object.fromEntries(new URL(req.url).searchParams) as TokenRequestParams;

    let profile: AuthorizedProfile;
    
    try {
        profile = await authorizeUser(req);
    } catch (e: any) {
        // Guest Access Logic
        const isAuthError = e.message === "Missing authorization header" || e.message === "No active session. Please sign in again.";
        
        if (isAuthError) {
             // Validate Guest Intent (Cannot publish)
             const allowPublish = 
                params.allowPublish === true || 
                params.allowPublish === "true" || 
                params.allowPublish === "1" ||
                // @ts-expect-error - canPublish might be passed
                params.canPublish === true;

             if (allowPublish) {
                 return new Response(JSON.stringify({ error: "Guests cannot publish. Please log in." }), {
                    status: 403,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                 });
             }
             
             // Create Guest Profile
             const guestId = params.identity && String(params.identity).startsWith("guest-") 
                ? String(params.identity) 
                : `guest-${crypto.randomUUID()}`;
                
             profile = {
                id: guestId,
                username: "Guest",
                role: "guest",
                avatar_url: null,
                is_broadcaster: false,
                is_admin: false,
                is_lead_officer: false,
                is_troll_officer: false
             };
             console.log(`[livekit-token] Guest access granted: ${guestId}`);
        } else {
            throw e; // Rethrow genuine server errors
        }
    }

    const room = params.room || params.roomName;

    // ✅ Fix identity: never allow "null" string to pass through
    const rawIdentity = params.identity;
    const identity =
      rawIdentity && rawIdentity !== "null" && rawIdentity !== null
        ? rawIdentity
        : profile.id;

    // ✅ FIX allowPublish parsing ("1" also counts)
    const allowPublish =
      params.allowPublish === true ||
      params.allowPublish === "true" ||
      params.allowPublish === "1" ||
      // @ts-expect-error - canPublish is not in the type definition but used
      params.canPublish === true; // Also accept canPublish


    const level = params.level;

    if (!room) {
      return new Response(JSON.stringify({ error: "Missing room" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const livekitUrl = Deno.env.get("LIVEKIT_URL");

    if (!apiKey || !apiSecret || !livekitUrl) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { AccessToken, TrackSource, RoomServiceClient } = await getLivekit();

    // ✅ Enforce 100 User Limit (Broadcasters + Viewers)
    try {
      const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
      const rooms = await svc.listRooms();
      let totalParticipants = 0;
      
      for (const r of rooms) {
        totalParticipants += r.numParticipants;
      }
      
      console.log(`[livekit-token] Current total participants: ${totalParticipants}`);
      
      if (totalParticipants >= 100) {
        console.warn("[livekit-token] Server full (>= 100 participants), denying access");
        return new Response(JSON.stringify({ error: "Server is full" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (svcError) {
      console.error("[livekit-token] Failed to check participant count:", svcError);
      // Proceeding despite error to avoid blocking users on API hiccups
    }

    // ✅ FIX role matching — allow publisher as well
    let canPublish = Boolean(allowPublish);
    const roleParam = String(params.role || "").toLowerCase();

    if (roleParam === "broadcaster" || roleParam === "publisher" || roleParam === "admin") {
      canPublish = true;
    }
    if (profile?.is_broadcaster || profile?.is_admin) canPublish = true;

    // ✅ FORCE CAN PUBLISH IF REQUESTED
    if (allowPublish) canPublish = true;

    console.log("[livekit-token] params:", {
      room,
      identity,
      roleParam,
      allowPublish,
      canPublish,
      level,
    });

    const metadata = {
      user_id: profile.id,
      username: profile.username,
      role: profile.role,
      avatar_url: profile.avatar_url,
      level: Number(level ?? 1),
    };

    // Reusing AccessToken and TrackSource from earlier import

    const token = new AccessToken(apiKey, apiSecret, {
      identity: String(identity),
      name: profile.username,
      ttl: 24 * 60 * 60, // 24 hours
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

    // ✅ CRITICAL: Ensure toJwt() returns a string, not an object
    // Handle both sync and async toJwt() methods
    let jwt: string;
    try {
      // Try calling toJwt() - it might be sync or async
      let jwtResult: any = token.toJwt();
      
      console.log('[livekit-token] toJwt() initial result:', {
        type: typeof jwtResult,
        isPromise: jwtResult instanceof Promise,
        isString: typeof jwtResult === 'string',
        preview: typeof jwtResult === 'string' ? jwtResult.substring(0, 50) : JSON.stringify(jwtResult).substring(0, 100)
      });
      
      // If it's a Promise, await it
      if (jwtResult instanceof Promise) {
        jwtResult = await jwtResult;
        console.log('[livekit-token] toJwt() Promise resolved:', {
          type: typeof jwtResult,
          isString: typeof jwtResult === 'string',
          preview: typeof jwtResult === 'string' ? jwtResult.substring(0, 50) : JSON.stringify(jwtResult).substring(0, 100)
        });
      }
      
      // ✅ STRICT VALIDATION: Ensure jwt is a string
      if (typeof jwtResult !== 'string') {
        console.error('[livekit-token] toJwt() returned non-string:', {
          type: typeof jwtResult,
          value: jwtResult,
          stringified: JSON.stringify(jwtResult),
          isPromise: jwtResult instanceof Promise,
          isObject: typeof jwtResult === 'object',
          constructor: jwtResult?.constructor?.name,
          keys: typeof jwtResult === 'object' && jwtResult !== null ? Object.keys(jwtResult) : 'N/A'
        });
        throw new Error(`toJwt() returned ${typeof jwtResult} instead of string. Value: ${JSON.stringify(jwtResult)}`);
      }
      
      jwt = jwtResult;
      
      // ✅ Validate JWT format (should start with 'eyJ')
      if (!jwt.startsWith('eyJ')) {
        console.error('[livekit-token] JWT does not have expected format:', {
          jwtPreview: jwt.substring(0, 50),
          jwtLength: jwt.length,
          firstChars: jwt.substring(0, 10)
        });
        throw new Error(`Invalid JWT format: expected string starting with 'eyJ', got '${jwt.substring(0, 20)}...'`);
      }
    } catch (jwtError: any) {
      console.error('[livekit-token] Failed to generate JWT:', jwtError);
      throw new Error(`JWT generation failed: ${jwtError?.message || jwtError}`);
    }

    const ms = Math.round(performance.now() - t0);
    console.log(`[livekit-token] ok room=${room} user=${profile.id} publish=${canPublish} jwtLen=${jwt.length} ${ms}ms`);

    // ✅ FINAL VALIDATION: Ensure jwt is still a string before returning
    if (typeof jwt !== 'string') {
      console.error('[livekit-token] JWT became non-string before return!', {
        jwt,
        type: typeof jwt,
        value: jwt
      });
      throw new Error(`JWT validation failed: expected string, got ${typeof jwt}`);
    }

    return new Response(
      JSON.stringify({
        token: String(jwt), // Explicit string conversion
        livekitUrl,
        url: livekitUrl,
        room,
        identity: String(identity),
        allowPublish: canPublish,
        publishAllowed: canPublish,
        roleParam,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const ms = Math.round(performance.now() - t0);
    console.error("[livekit-token] error", err?.message || err, `${ms}ms`);

    const status = String(err?.message || "").includes("Unauthorized") ? 403 : 500;
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
