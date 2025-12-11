import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers - Allow all origins for testing
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") ?? "live";

// Check for required environment variables
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  serve(async (req: Request) => {
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
  serve(async (req: Request) => {
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

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed" }),
      {
        status: 405,
        headers: { ...cors, "Content-Type": "application/json" }
      }
    );
  }

  try {
    // Parse request body
    const body = await req.json();
    const { amount, user_id, coins } = body;

    // Basic validation
    if (!amount || !user_id || !coins) {
      return new Response(JSON.stringify({
        error: "Missing required fields",
        received: { amount, user_id, coins }
      }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // For now, return a mock order ID to test the flow
    // TODO: Implement actual PayPal API call
    const mockOrderId = `mock_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Response(
      JSON.stringify({
        orderID: mockOrderId,
        status: "mock_success",
        message: "Mock PayPal order created for testing"
      }),
      {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" }
      }
    );

  } catch (e: any) {
    console.error("PayPal create order error:", e);
    return new Response(
      JSON.stringify({
        status: "error",
        message: e.message || "Unknown error creating PayPal order",
        error: e.toString()
      }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" }
      }
    );
  }
});
