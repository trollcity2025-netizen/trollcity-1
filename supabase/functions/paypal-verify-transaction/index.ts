export const config = {
  runtime: "edge",
};

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_BASE = "https://api-m.paypal.com";

// CORS headers
const cors = {
  "Access-Control-Allow-Origin": "https://trollcity.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get PayPal access token
async function getAccessToken() {
  const creds = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let res;
  try {
    res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    console.error("PayPal OAuth fetch failed:", e);
    throw new Error("PayPal OAuth stalled or blocked");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const txt = await res.text();
    console.error("PayPal OAuth error:", txt);
    throw new Error("Failed to obtain PayPal access token");
  }

  const json = await res.json();
  return json.access_token;
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: cors,
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
      }
    );
  }

  try {
    const body = await req.json();
    const orderId = body.order_id;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Missing order_id" }),
        {
          status: 400,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
        }
      );
    }

    const token = await getAccessToken();

    // Fetch order details from PayPal
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!orderRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch PayPal order", details: await orderRes.text() }),
        {
          status: 500,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
        }
      );
    }

    const order = await orderRes.json();
    const pu = order.purchase_units?.[0];
    const capture = pu?.payments?.captures?.[0];

    // Extract metadata from custom_id
    let meta: any = null;
    try {
      meta = JSON.parse(pu?.custom_id || "{}");
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        order_status: order.status,
        payer_email: order.payer?.email_address || null,
        amount: capture?.amount?.value || pu?.amount?.value || null,
        currency: capture?.amount?.currency_code || pu?.amount?.currency_code || "USD",
        capture_status: capture?.status || null,
        metadata: meta,
      }),
      {
        status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
      }
    );
  } catch (err: any) {
    console.error("❌ paypal-verify-transaction ERROR:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      {
        status: 500,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
      }
    );
  }
}
