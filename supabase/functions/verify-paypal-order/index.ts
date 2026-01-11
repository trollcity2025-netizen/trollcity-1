import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://maitrollcity.com",
  "https://www.maitrollcity.com",
  "http://localhost:3000",
  "http://localhost:5173"
]);

function corsHeaders(origin: string | null) {
  const allowOrigin = allowedOrigins.has(origin ?? "")
    ? origin!
    : "https://maitrollcity.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

const PAYPAL_BASE = Deno.env.get("PAYPAL_MODE") === "sandbox" 
  ? "https://api-m.sandbox.paypal.com" 
  : "https://api-m.paypal.com";

async function getAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials");
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get PayPal access token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // 1. Handle OPTIONS preflight immediately
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    const { orderID, user_id } = body;

    if (!orderID || !user_id) {
      return new Response(JSON.stringify({ error: "Missing orderID or user_id" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // 2. Get PayPal Access Token
    const accessToken = await getAccessToken();

    // 3. Capture the Order
    console.log(`Capturing order ${orderID}...`);
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    let captureData;
    if (captureRes.ok) {
        captureData = await captureRes.json();
    } else {
        const errorText = await captureRes.text();
        console.error("PayPal capture error:", errorText);
        
        // Check if already captured
        if (captureRes.status === 422) { // UNPROCESSABLE_ENTITY
             console.log("Order might be already captured, fetching details...");
             const detailsRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
             });
             if (detailsRes.ok) {
                 captureData = await detailsRes.json();
             } else {
                 throw new Error(`Failed to capture and failed to get details: ${errorText}`);
             }
        } else {
            throw new Error(`Failed to capture order: ${errorText}`);
        }
    }

    if (captureData.status !== "COMPLETED") {
        return new Response(JSON.stringify({ error: "Order not completed", status: captureData.status }), {
            status: 400,
            headers: { ...headers, "Content-Type": "application/json" }
        });
    }

    // 4. Verify Custom ID
    const purchaseUnit = captureData.purchase_units?.[0];
    const customIdRaw = purchaseUnit?.custom_id;
    
    if (!customIdRaw) {
        throw new Error("No custom_id found in PayPal order");
    }

    let customData;
    try {
        customData = JSON.parse(customIdRaw);
    } catch (e) {
        console.error("Failed to parse custom_id:", customIdRaw);
        throw new Error("Invalid custom_id format");
    }

    if (customData.userId !== user_id) {
        return new Response(JSON.stringify({ error: "User ID mismatch" }), {
            status: 403,
            headers: { ...headers, "Content-Type": "application/json" }
        });
    }

    const coinsToAdd = parseInt(customData.coins, 10);
    if (isNaN(coinsToAdd) || coinsToAdd <= 0) {
        throw new Error("Invalid coin amount in custom_id");
    }

    // 5. Initialize Supabase Admin Client
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 6. Add Coins
    // Check if we already processed this orderID
    const { data: existingTx } = await supabase
        .from("coin_transactions")
        .select("id")
        .eq("metadata->>paypal_order_id", orderID)
        .single();

    if (existingTx) {
        console.log(`Order ${orderID} already processed.`);
        return new Response(JSON.stringify({ success: true, message: "Already processed", coins_added: coinsToAdd }), {
            status: 200,
            headers: { ...headers, "Content-Type": "application/json" }
        });
    }

    // Award coins
    const { error: rpcError } = await supabase.rpc("add_troll_coins", {
        user_id_input: user_id,
        coins_to_add: coinsToAdd
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        throw new Error("Failed to add coins to user account");
    }

    // 7. Log Transaction
    const { error: logError } = await supabase.from("coin_transactions").insert({
        user_id: user_id,
        transaction_type: "store_purchase",
        amount: coinsToAdd,
        description: `PayPal Purchase: ${customData.type || 'coins'}`,
        metadata: {
            paypal_order_id: orderID,
            package_id: customData.packageId,
            paypal_capture_id: captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id,
            raw_custom_id: customData
        }
    });

    if (logError) {
        console.error("Failed to log transaction:", logError);
    }

    return new Response(JSON.stringify({ success: true, coins_added: coinsToAdd }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Verify Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
        status: 400, // Or 500 depending on error, but 400 is safer for client facing
        headers: { ...headers, "Content-Type": "application/json" }
    });
  }
});
