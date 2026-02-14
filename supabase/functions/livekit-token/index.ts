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
  attributes?: Record<string, any>;
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

async function authorizeUser(req: Request): Promise<AuthorizedProfile | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  
  // If no auth header, return null (Guest mode)
  if (!authHeader.startsWith("Bearer ")) {
    console.log("[authorizeUser] No auth header found - treating as Guest");
    return null;
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
    console.warn("[authorizeUser] User validation error (might be expired token):", userError?.message);
    return null; // Fallback to Guest instead of crashing
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

    let profile: AuthorizedProfile | null = null;
    
    try {
        profile = await authorizeUser(req);
    } catch (e: any) {
        console.error("[livekit-token] Authorization error:", e.message);
        throw e; // Rethrow genuine server errors
    }

    // Guest Access Logic if profile is null
    if (!profile) {
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

    // ✅ Enforce participant caps and LMPM logic
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const { createClient } = await getSupabase();
      const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

      // Check LMPM status
      const { data: lmpmSetting } = await supabaseAdmin
        .from("admin_app_settings")
        .select("setting_value")
        .eq("setting_key", "low_minute_protection_mode")
        .single();
      
      const lmpmEnabled = lmpmSetting?.setting_value?.enabled === true;
      const isBeforeDeadline = new Date() < new Date('2026-03-01T00:00:00Z');

      // Define caps based on mode
      const isPod = String(room).includes('-') && (String(room).startsWith('pod-') || String(room).length > 20); // Heuristic for pod IDs
      const applyLMPM = lmpmEnabled && (!isPod || isBeforeDeadline);

      const maxTotal = applyLMPM ? 7 : Number(Deno.env.get('LIVEKIT_MAX_TOTAL_PARTICIPANTS') || '600');
      const maxPerRoom = applyLMPM ? 7 : Number(Deno.env.get('LIVEKIT_MAX_PARTICIPANTS_PER_ROOM') || '60');
      const maxViewers = applyLMPM ? 5 : 60; // Standard viewer limit
      const maxGuests = applyLMPM ? 1 : 5;

      const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
      const rooms = await svc.listRooms();
      let totalParticipants = 0;
      let roomParticipants = 0;

      for (const r of rooms) {
        totalParticipants += r.numParticipants;
        if (r.name === String(room)) {
          roomParticipants = r.numParticipants;
        }
      }

      console.log(`[livekit-token] LMPM=${lmpmEnabled}, IsPod=${isPod}, ApplyingLMPM=${applyLMPM}, Total: ${totalParticipants}, Room=${room}: ${roomParticipants}`);

      // Global Server Full
      if (!applyLMPM && maxTotal > 0 && totalParticipants >= maxTotal) {
        return new Response(JSON.stringify({ error: "City bandwidth exhausted for today." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Room Full (Total 7 in LMPM)
      if (roomParticipants >= maxPerRoom) {
        return new Response(JSON.stringify({ error: isPod ? "The Town Square is full." : "Arena capacity reached." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Specific Role Caps in LMPM
      if (applyLMPM) {
        const participants = await svc.listParticipants(String(room));
        
        // Count roles
        let hostCount = 0;
        const _guestCount = 0;
        const _viewerCount = 0;

        for (const p of participants) {
          const metadata = JSON.parse(p.metadata || '{}');
          if (metadata.role === 'host') hostCount++;
          else if (metadata.role === 'guest' || metadata.role === 'stage' || metadata.role === 'speaker') hostCount++; // Pod speakers count towards capacity if we treat them as "publishers"
          else viewerCount++;
        }

        // 1. Host limit (Broadcaster/Host role)
        if (allowPublish && (profile.is_broadcaster || profile.role === 'broadcaster' || profile.is_admin || isPod)) {
          // If it's a pod, we allow up to 2 "publishers" (1 host + 1 guest/speaker) in LMPM? 
          // User said "1 host, 1 guest, 5 viewers". So max 2 publishers.
          const maxPublishers = isPod ? 2 : 1; 
          const currentPublishers = hostCount + guestCount;

          if (currentPublishers >= maxPublishers) {
             // Reconnect check
             const isExisting = participants.find(p => p.identity === identity);
             if (!isExisting) {
                return new Response(JSON.stringify({ error: isPod ? "This Pod has reached its speaker limit." : "Transmission already has a primary host." }), {
                  status: 403,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
             }
          }
        } 
        // 2. Guest limit (1 max in LMPM)
        else if (params.role === 'guest' || params.role === 'stage' || params.role === 'speaker') {
          if (guestCount >= maxGuests) {
            return new Response(JSON.stringify({ error: isPod ? "Pod guest limit reached." : "Guest permit limit reached." }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        // 3. Viewer limit (5 max in LMPM)
        else {
          if (viewerCount >= maxViewers) {
            return new Response(JSON.stringify({ error: isPod ? "The Town Square is full (5 viewers max)." : "Arena viewer capacity reached." }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

    } catch (svcError) {
      console.error("[livekit-token] Failed to check participant count:", svcError);
    }

    // ✅ FIX role matching — allow publisher as well
    let canPublish = false;
    
    // Strict role check from DB profile
    if (profile.is_broadcaster || profile.is_admin || profile.role === 'broadcaster' || profile.role === 'admin') {
      canPublish = true;
    }

    // Battle room override: allow host/stage participants to publish
    // Validate against battle_participants in DB to prevent spoofing
    if (!canPublish && room && room.startsWith('battle-') && !String(profile.id).startsWith('guest-')) {
      try {
        const battleId = room.replace('battle-', '');
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (supabaseUrl && supabaseServiceKey) {
          const { createClient } = await getSupabase();
          const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

          const { data: participant, error: participantError } = await supabaseAdmin
            .from('battle_participants')
            .select('role')
            .eq('battle_id', battleId)
            .eq('user_id', profile.id)
            .single();

          if (!participantError && participant?.role && (participant.role === 'host' || participant.role === 'stage')) {
            canPublish = true;
          }

          // Fallback: allow stream owners in battle if participant rows are missing
          if (!canPublish) {
            const { data: battle, error: battleError } = await supabaseAdmin
              .from('battles')
              .select('challenger_stream_id, opponent_stream_id')
              .eq('id', battleId)
              .single();

            if (!battleError && battle) {
              const { data: streams, error: streamsError } = await supabaseAdmin
                .from('streams')
                .select('id, user_id')
                .in('id', [battle.challenger_stream_id, battle.opponent_stream_id]);

              if (!streamsError && streams?.some((s) => s.user_id === profile.id)) {
                canPublish = true;
              }
            }
          }
        }
      } catch (e) {
        console.error('[livekit-token] Battle publish validation failed:', e);
      }
    }

    // Guest check is handled above in the catch block (guests are denied publish)

    console.log("[livekit-token] params:", {
      room,
      identity,
      canPublish,
      level,
    });

    const metadata = {
      user_id: profile.id,
      username: profile.username,
      role: profile.role,
      avatar_url: profile.avatar_url,
      level: Number(level ?? 1),
      ...(params.attributes || {})
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
        publishAllowed: canPublish,
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
