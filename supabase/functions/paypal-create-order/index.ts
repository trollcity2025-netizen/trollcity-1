export const config = {
  runtime: "edge",
};

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_BASE = "https://api-m.paypal.com";

// CORS headers
const cors = {
  "Access-Control-Allow-Origin": "https://trollcity.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PayPal token
async function getToken() {
  const creds = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("PayPal OAuth error:", txt);
    throw new Error("Failed to obtain PayPal access token");
  }

  const json = await res.json();
  return json.access_token;
}

export default async function handler(req: Request) {
  // ⭐ OPTIONS MUST BE FIRST ⭐
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: cors,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
    });
  }

  try {
    const body = await req.json();
    const { amount } = body;

    if (!amount) {
      return new Response(JSON.stringify({ error: "Missing amount field" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const token = await getToken();

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: Number(amount).toFixed(2), // ⭐ FIXED ⭐
            },
            custom_id: JSON.stringify({
              amount: Number(amount)
            }),
          },
        ],
      }),
    });

    const json = await orderRes.json();

    if (!orderRes.ok) {
      return new Response(JSON.stringify({ error: "PayPal create failed", details: json }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify({ id: json.id }), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Unknown error" }), {
      status: 500,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
    });
  }
}
