import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") ?? "live";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
  if (!res.ok) throw new Error("Failed to get PayPal token");
  const data = await res.json();
  return data.access_token as string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = authUser.user.id;
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response("Missing orderId", { status: 400 });
    }

    const accessToken = await getAccessToken();

    // Capture PayPal payment
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
      return new Response("Failed to capture payment", { status: 500 });
    }

    const orderData = await captureRes.json();
    const capture = orderData.purchase_units?.[0]?.payments?.captures?.[0];

    if (!capture || capture.status !== "COMPLETED") {
      return new Response("Payment not completed", { status: 400 });
    }

    // Parse custom_id to get userId
    const customMeta = JSON.parse(orderData.purchase_units[0].custom_id);
    if (customMeta.userId !== userId) {
      return new Response("User mismatch", { status: 403 });
    }

    // Verify user via RPC
    const { data: result, error: verifyError } = await supabase.rpc("verify_user", {
      p_user_id: userId,
      p_payment_method: "paypal",
      p_amount: 5.00,
      p_payment_reference: capture.id
    });

    if (verifyError) {
      console.error("Error verifying user:", verifyError);
      return new Response("Failed to verify user", { status: 500 });
    }

    return new Response(JSON.stringify({
      success: true,
      verified: true
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in verify-user-complete:", e);
    return new Response("Server error", { status: 500 });
  }
});

