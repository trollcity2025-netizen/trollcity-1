import { createClient } from "https://esm.sh/@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_BASE = "https://api-m.paypal.com";

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// CORS headers - Allow all origins for testing
const cors = {
  "Access-Control-Allow-Origin": "*",
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
    const { orderID, user_id } = await req.json();

    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);

    // Capture payment
    const captureRes = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const capture = await captureRes.json();
    console.log("CAPTURE:", capture);

    if (!capture.purchase_units) {
      return new Response(JSON.stringify({ success: false }), { status: 400 });
    }

    const custom_id = capture.purchase_units[0]?.custom_id;
    const [uid, coins] = custom_id.split("|");
    const coinAmount = Number(coins);

    if (uid !== user_id) {
      return new Response(JSON.stringify({ success: false, message: "User mismatch" }), { status: 400 });
    }

    // Add coins
    await supabase.rpc("add_troll_coins", {
      user_id_input: uid,
      coins_to_add: coinAmount
    });

    return new Response(
      JSON.stringify({ success: true, coins_awarded: coinAmount }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  }
}
