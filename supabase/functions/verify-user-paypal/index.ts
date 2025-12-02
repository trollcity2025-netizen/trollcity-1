import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") ?? "live";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PAYPAL_BASE =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-live.paypal.com";

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
    throw new Error("Failed to get PayPal token");
  }
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

    // Check if already verified
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_verified")
      .eq("id", userId)
      .single();

    if (profile?.is_verified) {
      return new Response(JSON.stringify({ error: "User already verified" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const accessToken = await getAccessToken();

    // Create PayPal order for $5 verification
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: "5.00"
            },
            description: "Troll City Account Verification",
            custom_id: JSON.stringify({ userId, type: "verification" })
          }
        ],
        application_context: {
          brand_name: "Troll City",
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW",
          return_url: `${FRONTEND_URL}/verify/complete`,
          cancel_url: `${FRONTEND_URL}/verify`
        }
      })
    });

    if (!orderRes.ok) {
      console.error("PayPal order error", await orderRes.text());
      return new Response("Failed to create order", { status: 500 });
    }

    const orderData = await orderRes.json();
    const approveUrl = (orderData.links || []).find(
      (l: any) => l.rel === "approve"
    )?.href;

    return new Response(
      JSON.stringify({
        orderId: orderData.id,
        approvalUrl: approveUrl
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in verify-user-paypal:", e);
    return new Response("Server error", { status: 500 });
  }
});

