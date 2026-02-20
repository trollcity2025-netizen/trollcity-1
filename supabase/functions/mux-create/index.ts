/// <reference types="npm:@mux/mux-node@8.3.0" />
// supabase/functions/mux-create/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import Mux from "@mux/mux-node";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { stream_id: streamId } = await req.json();

    if (!streamId) {
      throw new Error("streamId is required.");
    }


    const muxTokenId = Deno.env.get("MUX_TOKEN_ID");
    const muxTokenSecret = Deno.env.get("MUX_TOKEN_SECRET");

    console.log(`Found MUX_TOKEN_ID: ${muxTokenId ? '...'+muxTokenId.slice(-4) : 'Not Found'}`);

    if (!muxTokenId || !muxTokenSecret) {
      throw new Error("Mux API credentials are not set in environment variables.");
    }

    const mux = new Mux({
      tokenId: muxTokenId,
      tokenSecret: muxTokenSecret,
    });

    console.log("Creating Mux live stream...");
    const liveStream = await mux.video.liveStreams.create({
      playback_policy: ["public"],
      reconnect_window: 60, // seconds
      new_asset_settings: {
        playback_policy: ["public"],
      },
      passthrough: streamId,
      test: Deno.env.get("APP_ENV") !== 'production',
    });
    console.log("Mux live stream created:", JSON.stringify(liveStream, null, 2));


    const playbackId = liveStream.playback_ids?.[0]?.id;
    if (!playbackId) {
      console.error("Mux response did not contain playback_id. Full response:", JSON.stringify(liveStream, null, 2));
      throw new Error("Failed to create Mux playback ID.");
    }

    return new Response(
      JSON.stringify({
        playback_id: playbackId,
        stream_key: liveStream.stream_key,
        rtmp_url: liveStream.rtmp_url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const e = error as Error;
    console.error("Error in mux-create function:", e);
    return new Response(JSON.stringify({ error: e.message, details: e.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});