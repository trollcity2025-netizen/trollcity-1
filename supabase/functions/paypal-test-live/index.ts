import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers
const cors = {
  "Access-Control-Allow-Origin": "https://trollcity.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") ?? "live";

// Check for required environment variables
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  serve(async (req) => {
    return new Response(
      JSON.stringify({
        status: "error",
        environment: PAYPAL_MODE,
        message: "Missing PayPal credentials. PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in Supabase Edge Function environment variables."
      }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" }
      }
    );
  });
}

// Enforce LIVE mode only
if (PAYPAL_MODE !== "live") {
  serve(async (req) => {
    return new Response(
      JSON.stringify({
        status: "error",
        environment: PAYPAL_MODE,
        message: "PayPal is restricted to LIVE mode only. PAYPAL_MODE must be 'live'."
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" }
      }
    );
  });
}

const PAYPAL_BASE = "https://api-m.paypal.com";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed" }),
      {
        status: 405,
        headers: { ...cors, "Content-Type": "application/json" }
      }
    );
  }

  try {
    // Test PayPal LIVE API connection
    const creds = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    if (!res.ok) {
      const errorText = await res.text();
      return new Response(
        JSON.stringify({
          status: "error",
          environment: "live",
          message: `Failed to connect to PayPal LIVE API: ${errorText}`,
          httpStatus: res.status
        }),
        {
          status: 200, // Return 200 so frontend can display error
          headers: { ...cors, "Content-Type": "application/json" }
        }
      );
    }

    const data = await res.json();

    if (data.access_token) {
      return new Response(
        JSON.stringify({
          status: "ok",
          environment: "live",
          message: "Successfully connected to PayPal LIVE API",
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" }
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          status: "error",
          environment: "live",
          message: "No access token received from PayPal"
        }),
        {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" }
        }
      );
    }
  } catch (e: any) {
    console.error("PayPal test error:", e);
    return new Response(
      JSON.stringify({
        status: "error",
        environment: "live",
        message: e.message || "Unknown error testing PayPal connection",
        error: e.toString()
      }),
      {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" }
      }
    );
  }
});

