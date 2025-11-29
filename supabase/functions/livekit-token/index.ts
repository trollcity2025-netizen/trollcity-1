/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

Deno.env.set("SUPABASE_VERIFY_JWT", "false");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const room = url.searchParams.get("room");
    const identity = url.searchParams.get("identity");

    if (!room || !identity) {
      throw new Error("Missing 'room' or 'identity' in query params");
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY") || Deno.env.get("VITE_LIVEKIT_API_KEY") || "";
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET") || Deno.env.get("VITE_LIVEKIT_API_SECRET") || "";
    const livekitUrl = Deno.env.get("LIVEKIT_CLOUD_URL") || Deno.env.get("VITE_LIVEKIT_URL") || "";

    if (!apiKey || !apiSecret || !livekitUrl) {
      return new Response(JSON.stringify({ error: "LiveKit credentials missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      iss: apiKey,
      sub: identity,
      exp: getNumericDate(3600),
      video: {
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    };

    const token = await create({ alg: "HS256", typ: "JWT" }, payload, apiSecret);

    return new Response(
      JSON.stringify({ token, url: livekitUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
