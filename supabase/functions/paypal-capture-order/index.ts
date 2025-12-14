import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") ?? "live";

// CORS headers - Allow all origins for testing
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return new Response("Unauthorized", { status: 401, headers: cors });

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      token
    );
    if (userErr || !userData.user) {
      console.error("Auth error", userErr);
      return new Response("Unauthorized", { status: 401, headers: cors });
    }
    const currentUserId = userData.user.id;

    const body = await req.json();
    const orderId = body.orderID as string;
    if (!orderId) {
      return new Response("Missing orderID", { status: 400, headers: cors });
    }

    console.log(`PayPal capture: orderID=${orderId}, env=${PAYPAL_MODE}, clientId=${PAYPAL_CLIENT_ID?.substring(0, 8)}...`);

    const accessToken = await getAccessToken();

    // Get current order status
    let orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!orderRes.ok) {
      console.error("PayPal get order error", await orderRes.text());
      return new Response("Failed to fetch order", { status: 500, headers: cors });
    }

    let orderData = await orderRes.json();

    if (orderData.status !== "COMPLETED") {
      // Try to capture
      const captureRes = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (!captureRes.ok) {
        const errorText = await captureRes.text();
        console.error("PayPal capture error:", errorText);
        const debugId = captureRes.headers.get('paypal-debug-id') || 'unknown';
        return new Response(JSON.stringify({
          error: "Failed to capture payment",
          paypalDebugId: debugId,
          details: errorText
        }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }

      orderData = await captureRes.json();
    }

    const purchaseUnit = orderData.purchase_units?.[0];
    const payments = purchaseUnit?.payments;
    const capture = payments?.captures?.[0];

    if (!capture || capture.status !== "COMPLETED") {
      console.error("Capture not completed", capture);
      return new Response("Payment not completed", { status: 400, headers: cors });
    }

    // Decode custom metadata
    let meta: { userId: string; packageId: string; coins: number } | null =
      null;
    try {
      meta = JSON.parse(purchaseUnit.custom_id);
    } catch (_e) {
      console.error("Failed to parse custom_id", purchaseUnit.custom_id);
    }

    if (!meta?.userId || !meta.coins) {
      return new Response("Missing metadata", { status: 400, headers: cors });
    }

    // Optional safety: ensure order belongs to this logged-in user
    if (meta.userId !== currentUserId) {
      console.warn("User mismatch on capture", {
        metaUser: meta.userId,
        currentUserId
      });
      // still proceed, but you could block if you want
    }

    const usdAmount = Number(
      capture.amount?.value ? capture.amount.value : purchaseUnit.amount.value
    );
    const payerEmail =
      capture.seller_receivable_breakdown?.net_amount?.value ??
      orderData.payer?.email_address ??
      null;

    // Get current balance first
    const { data: profileData, error: profileErr } = await supabase
      .from("user_profiles")
      .select("paid_coin_balance")
      .eq("id", meta.userId)
      .single();

    if (profileErr) {
      console.error("Profile fetch error", profileErr);
      return new Response("Failed to fetch profile", { status: 500, headers: cors });
    }

    const currentBalance = profileData?.paid_coin_balance ?? 0;

    // Update DB: transaction + balance
    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: meta.userId,
      coins: meta.coins,
      usd_amount: usdAmount,
      source: "paypal_web",
      external_id: capture.id,
      payer_email: payerEmail,
      payment_status: capture.status,
      payment_method: "paypal_web",
      metadata: orderData
    });

    if (txErr) {
      console.error("Insert transaction error", txErr);
      return new Response("Failed to log transaction", { status: 500, headers: cors });
    }

    const { error: balErr } = await supabase
      .from("user_profiles")
      .update({
        paid_coin_balance: currentBalance + meta.coins
      })
      .eq("id", meta.userId);

    if (balErr) {
      console.error("Update balance error", balErr);
      return new Response("Failed to update balance", { status: 500, headers: cors });
    }

    return new Response(
      JSON.stringify({
        success: true,
        coinsAdded: meta.coins,
        orderId: orderId,
        captureId: capture.id
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500, headers: cors });
  }
});
