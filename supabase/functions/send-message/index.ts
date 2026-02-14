import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { corsHeaders } from "../_shared/cors.ts";

const SIGNING_SECRETS: Record<string, string> = {
  "k1": Deno.env.get("SIGNING_SECRET_K1") || "fallback-secret-k1-change-me",
  "k2": Deno.env.get("SIGNING_SECRET_K2") || "fallback-secret-k2-change-me",
};
const CURRENT_KID = "k1";

// const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes
const SAMPLE_RATE_DEFAULT = 20; // 20%
const HOT_STREAM_THRESHOLD = 5000;

// --- Transport Abstraction ---

interface TransportAdapter {
  publish(channel: string, event: string, payload: any): Promise<void>;
}

class SupabaseTransportAdapter implements TransportAdapter {
  constructor(private supabase: any) {}
  async publish(channel: string, event: string, payload: any) {
    const chan = this.supabase.channel(channel);
    await chan.send({
      type: "broadcast",
      event: event,
      payload: payload,
    });
    // Note: Supabase broadcast is fire-and-forget in some client libs, 
    // but here we just ensure the call is made.
  }
}

class RedisStreamAdapter implements TransportAdapter {
  constructor(private redis: Redis) {}
  async publish(channel: string, _event: string, payload: any) {
    // A1) Publish to tc_events_v1 for persistence
    await this.redis.xadd("tc_events_v1", "*", {
      txn_id: payload.txn_id,
      stream_id: payload.stream_id,
      t: payload.t,
      ts: payload.ts.toString(),
      s: payload.s,
      v: payload.v.toString(),
      kid: payload.kid,
      payload: JSON.stringify(payload),
    });
    
    // Also publish to ephemeral stream for real-time workers if needed
    await this.redis.xadd(`stream:${channel}`, "*", {
      envelope: JSON.stringify(payload),
    });
  }
}

/**
 * AblyTransportAdapter (Stub)
 * Demonstrates the "Transport Swap Hook" logic.
 * In a real implementation, this would use the Ably REST SDK.
 */
// class AblyTransportAdapter implements TransportAdapter {
//   async publish(channel: string, event: string, payload: any) {
//     console.log(`[TRANSPORT_SWAP_STUB] Ably publishing to channel "${channel}" event "${event}"`);
//     console.log(`[TRANSPORT_SWAP_STUB] Envelope integrity check: txn_id=${payload.txn_id} sig=${payload.sig.substring(0, 8)}...`);
//     // Mock network latency
//     await new Promise(resolve => setTimeout(resolve, 10));
//   }
// }

// Initialize Redis if credentials are provided
let redis: Redis | null = null;
try {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (redisUrl && redisToken) {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  }
} catch (e) {
  console.error("Failed to initialize Redis:", e);
}

interface MessagePayload {
  type: "chat" | "gift" | "mod" | "sys" | "battle" | "count";
  stream_id: string;
  txn_id: string;
  data: any;
}

// --- Utilities ---

function canonicalizeJson(obj: any): string {
  if (typeof obj !== "object" || obj === null) return JSON.stringify(obj);
  const keys = Object.keys(obj).sort();
  const sortedObj: any = {};
  for (const key of keys) {
    sortedObj[key] = canonicalizeJson(obj[key]);
  }
  return JSON.stringify(sortedObj);
}

async function getPayloadHash(data: any): Promise<string> {
  const canonical = canonicalizeJson(data);
  const msgUint8 = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signMessage(message: string, kid: string): Promise<string> {
  const secret = SIGNING_SECRETS[kid];
  if (!secret) throw new Error(`Unknown KID: ${kid}`);
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body: MessagePayload = await req.json();
    const { type, stream_id, txn_id, data } = body;

    // 2. Validate input
    if (!type || !stream_id || !txn_id || !data) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 3. Replay Protection (Fail-Closed)
    if (redis) {
      try {
        const replayKey = `txn:${txn_id}`;
        const isReplay = await redis.set(replayKey, "1", { nx: true, ex: 900 }); // 15 min TTL
        if (!isReplay) {
          console.warn(`[SECURITY] Replay detected: txn_id=${txn_id} user_id=${user.id}`);
          return new Response(JSON.stringify({ error: "Replay detected", code: "REPLAY_ERROR" }), {
            status: 403,
            headers: { ...headers, "Content-Type": "application/json" },
          });
        }
      } catch (redisErr) {
        console.error(`[CRITICAL] Redis unavailable for replay protection: ${redisErr}`);
        return new Response(JSON.stringify({ error: "Service temporarily unavailable", code: "REDIS_UNAVAILABLE" }), {
          status: 503,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    // 3.5 Clock Skew Validation
    const now = Date.now();
    const ts = now; // We use server time for the envelope
    // If client provided a 'ts', we would validate: if (Math.abs(now - body.ts) > MAX_CLOCK_SKEW_MS) ...

    // 4. Validate Stream and User Status (Muted/Banned) + Get Profile
    const [
      { data: stream, error: streamError },
      { data: profile, error: profileError },
      { data: mute },
      { data: ban },
      { data: viewerCount }
    ] = await Promise.all([
      supabase.from("streams").select("id, is_live").eq("id", stream_id).single(),
      supabase.from("user_profiles").select("*").eq("id", user.id).single(),
      supabase.from("stream_mutes").select("id").eq("stream_id", stream_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("stream_bans").select("id, expires_at").eq("stream_id", stream_id).eq("user_id", user.id).maybeSingle(),
      redis ? redis.get(`viewercount:${stream_id}`) : Promise.resolve(0)
    ]);

    if (streamError || !stream) {
      console.log(`[AUTH] Stream not found or inactive: ${stream_id}`);
      return new Response(JSON.stringify({ error: "Stream not found or inactive", code: "STREAM_NOT_FOUND" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (profileError || !profile) {
      console.log(`[AUTH] User profile not found: ${user.id}`);
      return new Response(JSON.stringify({ error: "User profile not found", code: "USER_NOT_FOUND" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (mute) {
      console.log(`[AUTH] User muted: ${user.id} in stream ${stream_id}`);
      return new Response(JSON.stringify({ error: "You are muted in this stream", code: "MUTED" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (ban) {
      const isExpired = ban.expires_at && new Date(ban.expires_at) < new Date();
      if (!isExpired) {
        console.log(`[AUTH] User banned: ${user.id} in stream ${stream_id}`);
        return new Response(JSON.stringify({ error: "You are banned from this stream", code: "BANNED" }), {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    // 5. Rate Limiting (Fail-Open for availability)
    const isMod = profile.role === "admin" || profile.role === "moderator" || profile.troll_role === "officer";
    const currentViewerCount = Number(viewerCount) || 0;

    // B1) Deterministic Sampling
    if (type === "chat" && !isMod && currentViewerCount >= HOT_STREAM_THRESHOLD) {
      // Deterministic hash based on user_id + stream_id
      const hashInput = `${user.id}${stream_id}`;
      const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(hashInput));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashVal = hashArray[0] % 100; // Simple modulo for sampling
      
      if (hashVal >= SAMPLE_RATE_DEFAULT) {
        console.log(`[SAMPLING] Message dropped for user ${user.id} (High Traffic Mode)`);
        return new Response(JSON.stringify({ 
          error: "High traffic mode active", 
          code: "SAMPLING_ACTIVE",
          sample_rate: SAMPLE_RATE_DEFAULT 
        }), {
          status: 202, // Accepted but not processed/broadcasted
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    if (redis) {
      const rateLimitKey = `ratelimit:${user.id}:${type}`;
      try {
        const count = await redis.incr(rateLimitKey);
        if (count === 1) await redis.expire(rateLimitKey, 1);
        if (count > 5) {
          console.warn(`[AUTH] Rate limit exceeded: user_id=${user.id} type=${type}`);
          return new Response(JSON.stringify({ error: "Rate limit exceeded", code: "RATE_LIMITED" }), {
            status: 429,
            headers: { ...headers, "Content-Type": "application/json" },
          });
        }
      } catch (err) {
        console.error(`[MONITOR] Rate limit check failed, allowing: ${err}`);
      }
    }

    // 6. Enrich Data (Denormalize server-side for security)
    const enrichedData = {
      ...data,
      user_name: profile.username,
      user_avatar: profile.avatar_url,
      user_role: profile.role,
      user_troll_role: profile.troll_role,
      user_created_at: profile.created_at,
      user_rgb_expires_at: profile.rgb_username_expires_at,
      user_glowing_username_color: profile.glowing_username_color,
    };

    // 7. Canonicalize and Sign
    const payloadHash = await getPayloadHash(enrichedData);
    const canonicalString = `v=1|t=${type}|stream_id=${stream_id}|sender_id=${user.id}|txn_id=${txn_id}|ts=${ts}|payload_hash=${payloadHash}`;
    const sig = await signMessage(canonicalString, CURRENT_KID);

    const envelope = {
      v: 1,
      kid: CURRENT_KID,
      t: type,
      stream_id: stream_id,
      s: user.id,
      ts: ts,
      txn_id: txn_id,
      d: enrichedData,
      sig: sig,
    };


    // 8. Publish via Adapters
    const adapters: TransportAdapter[] = [
      new SupabaseTransportAdapter(supabase),
      // new AblyTransportAdapter(), // <--- ONE-LINE SWAP: Uncomment to enable Ably transport
    ];
    if (redis) adapters.push(new RedisStreamAdapter(redis));

    // B2) Hot Stream Protection (Sys Event for High Traffic)
    if (currentViewerCount >= HOT_STREAM_THRESHOLD && redis) {
      const lastNotifyKey = `notified_high_traffic:${stream_id}`;
      const alreadyNotified = await redis.get(lastNotifyKey);
      if (!alreadyNotified) {
        const sysEvent = {
          v: 1,
          t: "sys",
          stream_id: stream_id,
          ts: Date.now(),
          d: { mode: "high_traffic", sample_rate: SAMPLE_RATE_DEFAULT }
        };
        await Promise.all(adapters.map(a => a.publish(stream_id, "message", sysEvent)));
        await redis.set(lastNotifyKey, "1", { ex: 300 }); // Notify every 5 mins
      }
    }

    await Promise.allSettled(
      adapters.map(a => a.publish(stream_id, "message", envelope))
    );

    console.log(`[SUCCESS] Message signed and published: txn_id=${txn_id} type=${type} user_id=${user.id}`);

    // Return signed envelope to sender
    return new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

