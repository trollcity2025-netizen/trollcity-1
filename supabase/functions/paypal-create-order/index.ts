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

console.log(`PayPal env: mode=${PAYPAL_MODE}, clientId=${PAYPAL_CLIENT_ID?.substring(0, 8)}...`);

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

const PAYPAL_BASE =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
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
    console.error("PayPal token error", await res.text());
    throw new Error("Failed to get PayPal token");
  }
  const data = await res.json();
  return data.access_token as string;
}

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

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Create PayPal order
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount.toString()
          },
          custom_id: JSON.stringify({
            userId: user_id,
            coins: coins
          })
        }
      ]
    };

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderPayload)
    });

    if (!orderRes.ok) {
      const errorText = await orderRes.text();
      console.error("PayPal create order error:", errorText);
      return new Response(JSON.stringify({
        error: "Failed to create PayPal order",
        details: errorText
      }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const orderData = await orderRes.json();
    console.log("PayPal order created:", orderData.id);

    return new Response(
      JSON.stringify({
        orderID: orderData.id
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
