import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Redis } from "@upstash/redis";
import { corsHeaders } from "../_shared/cors.ts";

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

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }

  try {
    const { stream_id } = await req.json();

    if (!stream_id) {
      return new Response(JSON.stringify({ error: "Missing stream_id" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (!redis) {
      return new Response(JSON.stringify({ error: "Redis not configured" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const abuseKey = `stream_abuse_score:${stream_id}`;
    const score = await redis.get(abuseKey) || 0;

    return new Response(JSON.stringify({ score: Number(score) }), {
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
