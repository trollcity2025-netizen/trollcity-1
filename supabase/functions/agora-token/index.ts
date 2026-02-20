import { RtcTokenBuilder, RtcRole } from "agora-access-token";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // ✅ Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const channel = body.channel;
    const uid = body.uid ?? 0; // 0 means app-assigned
    const role = body.role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expireSeconds = Number(body.expireSeconds) || 3600;

    const appId = Deno.env.get("AGORA_APP_ID") || "";
    const appCert = Deno.env.get("AGORA_APP_CERTIFICATE") || "";

    if (!appId || !appCert) {
      const missing = [];
      if (!appId) missing.push("AGORA_APP_ID");
      if (!appCert) missing.push("AGORA_APP_CERTIFICATE");
      return new Response(JSON.stringify({ error: "Agora not configured", missing }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    if (!channel) {
      return new Response(JSON.stringify({ error: "Missing channel parameter" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const currentTs = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTs + expireSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCert, channel, Number(uid), role, privilegeExpiredTs);

    return new Response(JSON.stringify({ token, appId, channel, uid }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (err) {
    console.error("agora-token error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
