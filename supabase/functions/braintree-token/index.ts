import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const BT_MERCHANT_ID = Deno.env.get("BT_MERCHANT_ID") || "";
    const BT_PUBLIC_KEY = Deno.env.get("BT_PUBLIC_KEY") || "";
    const BT_PRIVATE_KEY = Deno.env.get("BT_PRIVATE_KEY") || "";
    const BT_ENV = (Deno.env.get("BT_ENV") || "sandbox").toLowerCase();

    if (!BT_MERCHANT_ID || !BT_PUBLIC_KEY || !BT_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "Braintree not configured in Edge Function secrets" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const gatewayHost = BT_ENV === "production" ? "api.braintreegateway.com" : "api.sandbox.braintreegateway.com";
    const url = `https://${gatewayHost}/merchants/${BT_MERCHANT_ID}/client_token`;

    const auth = btoa(`${BT_PUBLIC_KEY}:${BT_PRIVATE_KEY}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Failed to get client token", details: text }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Braintree may return JSON or XML; try parse JSON first
    let payload: any = null;
    try { payload = JSON.parse(text); } catch {
      // If it's something else, return raw
      return new Response(JSON.stringify({ clientToken: text }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Braintree JSON shape: { client_token: "..." }
    const clientToken = payload?.client_token ?? payload?.clientToken ?? null;
    if (!clientToken) {
      return new Response(JSON.stringify({ error: "No client token returned", details: payload }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ clientToken }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("braintree-token error", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
