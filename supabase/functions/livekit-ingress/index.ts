import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { IngressClient, IngressInput } from "livekit-server-sdk";

type IngressResponse = {
  rtmp_url: string;
  stream_key: string;
  room_name: string;
  max_resolution: number;
  eligible_1080p: boolean;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight();
  }

  try {
    const origin = req.headers.get("origin") ?? "";
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    let body: { broadcaster_id?: string; rotate?: boolean } = {};
    try {
      body = (await req.json()) as { broadcaster_id?: string; rotate?: boolean };
    } catch {
      body = {};
    }
    const rotate = !!body.rotate;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, username, role, is_admin, stream_key, ingress_id, ingress_room_name, ingress_url")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    const roomName = `trollmers_${user.id.replace(/-/g, "")}`;

    const { data: creditsData, error: creditsError } = await supabaseAdmin.rpc(
      "get_7d_coin_credits",
      { p_user_id: user.id }
    );

    if (creditsError) {
      console.warn("[livekit-ingress] Failed to read coin credits:", creditsError);
    }

    const credits = Number(creditsData ?? 0);
    const eligible1080p = credits >= 5000;
    const maxResolution = eligible1080p ? 1080 : 720;

    const livekitUrl = Deno.env.get("LIVEKIT_URL") ?? "";
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    const ingressUrlFallback = Deno.env.get("LIVEKIT_INGRESS_URL") ?? "";

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      throw new Error("LiveKit configuration missing");
    }

    const apiUrl = livekitUrl.replace("wss://", "https://").replace("ws://", "http://");
    const ingressClient = new IngressClient(apiUrl, livekitApiKey, livekitApiSecret);

    if (!rotate && profile.ingress_id && profile.ingress_room_name === roomName && profile.stream_key && profile.ingress_url) {
      console.log("[livekit-ingress] Reusing existing ingress", {
        ingressId: profile.ingress_id,
        roomName
      });

      const response: IngressResponse = {
        rtmp_url: profile.ingress_url,
        stream_key: profile.stream_key,
        room_name: roomName,
        max_resolution: maxResolution,
        eligible_1080p: eligible1080p
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
      });
    }

    if (profile.ingress_id && (profile.ingress_room_name !== roomName || rotate)) {
      try {
        await ingressClient.deleteIngress(profile.ingress_id);
        console.log("[livekit-ingress] Deleted stale ingress", profile.ingress_id);
      } catch (err) {
        console.warn("[livekit-ingress] Failed to delete stale ingress", err);
      }
    }

    const ingressOptions: Record<string, any> = {
      name: `trollmers_${user.id}`,
      roomName,
      participantIdentity: user.id,
      participantName: profile.username || user.id,
      bypassTranscoding: false,
      video: {
        width: maxResolution === 1080 ? 1920 : 1280,
        height: maxResolution === 1080 ? 1080 : 720,
        fps: 30,
        bitrate: maxResolution === 1080 ? 4500000 : 2500000
      },
      audio: {
        bitrate: 128000
      }
    };

    const ingress = await ingressClient.createIngress(
      (IngressInput as any)?.RTMP ?? 1,
      ingressOptions
    );

    const ingressId = ingress?.ingressId || ingress?.id || "";
    const streamKey = ingress?.streamKey || ingress?.stream_key || profile.stream_key || "";
    const rtmpUrl = ingress?.url || ingress?.rtmp?.url || ingressUrlFallback || "";

    if (!streamKey) {
      throw new Error("Ingress stream key missing");
    }

    if (!rtmpUrl) {
      throw new Error("Ingress URL not configured");
    }

    const { error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update({
        stream_key: streamKey,
        ingress_id: ingressId,
        ingress_room_name: roomName,
        ingress_url: rtmpUrl,
        ingress_updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    console.log("[livekit-ingress] Ingress ready", {
      userId: user.id,
      roomName,
      ingressId,
      rtmpUrl,
      eligible1080p,
      maxResolution
    });

    const response: IngressResponse = {
      rtmp_url: rtmpUrl,
      stream_key: streamKey,
      room_name: roomName,
      max_resolution: maxResolution,
      eligible_1080p: eligible1080p
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[livekit-ingress] Error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
    });
  }
});
