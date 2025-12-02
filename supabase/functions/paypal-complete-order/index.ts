// @ts-expect-error - Deno runtime handles URL imports
import { createClient } from "jsr:@supabase/supabase-js@2";

export const config = {
  runtime: "edge",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_BASE = "https://api-m.paypal.com";

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

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
    const body = await req.json();
    const orderId = body.paypal_order_id;
    const userId = body.user_id;

    if (!orderId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing paypal_order_id or user_id" }),
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

    // Fetch order details
    let orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
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

    let order = await orderRes.json();

    // Capture if necessary
    if (order.status !== "COMPLETED") {
      const captureRes = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!captureRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to capture PayPal payment", details: await captureRes.text() }),
          {
            status: 500,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
          }
        );
      }

      order = await captureRes.json();
    }

    const pu = order.purchase_units?.[0];
    const capture = pu?.payments?.captures?.[0];

    if (!capture || capture.status !== "COMPLETED") {
      return new Response(
        JSON.stringify({ error: "Payment not completed" }),
        {
          status: 400,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
        }
      );
    }

    // Extract metadata from custom_id
    let meta: any = null;
    try {
      meta = JSON.parse(pu?.custom_id || "{}");
    } catch (_) {}

    if (!meta || !meta.coins) {
      return new Response(
        JSON.stringify({ error: "Missing coin metadata in PayPal order" }),
        {
          status: 500,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
        }
      );
    }

    const coins = Number(meta.coins);
    const usdAmount = Number(capture.amount.value);
    const payerEmail = order.payer?.email_address || null;

    // Duplicate check
    const { data: existingTx } = await supabase
      .from("coin_transactions")
      .select("id")
      .eq("external_id", capture.id)
      .single();

    if (existingTx) {
      return new Response(
        JSON.stringify({ success: true, message: "Already processed", coins_awarded: coins }),
        {
          status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
        }
      );
    }

    // Fetch current balance
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("paid_coin_balance")
      .eq("id", userId)
      .single();

    const currentBalance = profile?.paid_coin_balance || 0;
    const newBalance = currentBalance + coins;

    // Update coin balance
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ paid_coin_balance: newBalance })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating balance:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update coin balance" }),
        {
          status: 500,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
        }
      );
    }

    // Insert coin transaction
    const { error: txError } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      type: "purchase",
      coins: coins,
      amount_usd: usdAmount,
      external_id: capture.id,
      payment_provider: "paypal",
      paypal_order_id: orderId,
      payment_status: capture.status,
      status: "completed",
      description: `Coin purchase: +${coins} coins`,
      metadata: meta,
    });

    if (txError) {
      console.error("Error inserting transaction:", txError);
      // Don't fail - balance already updated
    }

    return new Response(
      JSON.stringify({
        success: true,
        coins_awarded: coins,
        amount_usd: usdAmount,
        balance_after: newBalance,
        payer_email: payerEmail,
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
    console.error("❌ paypal-complete-order ERROR:", err);
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
