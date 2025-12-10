import { createClient } from "https://esm.sh/@supabase/supabase-js";

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
    const { amount, user_id, coins } = await req.json();

    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);

    const res = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: amount.toFixed(2),
            },
            custom_id: `${user_id}|${coins}`,
          },
        ],
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify({ orderID: data.id }), {
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Order creation failed" }), { status: 500 });
  }
}
