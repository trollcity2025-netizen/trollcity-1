import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface _PayoutRequest {
  id: string;
  user_id: string;
  coin_amount: number;
  cash_amount: number;
  bonus_amount: number;
  net_amount: number;
  user_profiles: {
    payout_paypal_email: string;
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // 1. Authenticate Admin/Secretary
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabaseClient
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "secretary" && !profile.is_admin)) {
      throw new Error("Forbidden: Admin or Secretary role required");
    }

    // 2. Parse Request
    const { batchId } = await req.json();
    if (!batchId) throw new Error("Missing batchId");

    console.log(`Processing PayPal Payout for Batch: ${batchId}`);

    // 3. Fetch Batch and Requests
    const { data: batch, error: batchError } = await supabaseClient
      .from("payout_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) throw new Error("Batch not found");
    if (batch.status === "completed") throw new Error("Batch already completed");

    const { data: requests, error: requestsError } = await supabaseClient
      .from("payout_requests")
      .select("*, user_profiles(payout_paypal_email)")
      .eq("batch_id", batchId)
      .eq("status", "pending");

    if (requestsError) throw new Error(`Fetch Requests Error: ${requestsError.message}`);
    if (!requests || requests.length === 0) {
      return new Response(JSON.stringify({ message: "No pending requests in this batch" }), {
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // 4. PayPal Integration
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
    const mode = Deno.env.get("PAYPAL_MODE") || "sandbox";
    const baseUrl = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    if (!clientId || !secret) {
      throw new Error("Missing PayPal credentials");
    }

    // Get Access Token
    const auth = btoa(`${clientId}:${secret}`);
    const tokenResp = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      throw new Error(`PayPal Token Error: ${tokenResp.status} ${errText}`);
    }
    
    const { access_token } = await tokenResp.json();

    // 5. Construct PayPal Batch
    const items = requests
      .filter((r: any) => r.user_profiles?.payout_paypal_email)
      .map((r: any) => ({
        recipient_type: "EMAIL",
        amount: {
          value: Number(r.net_amount).toFixed(2),
          currency: "USD",
        },
        receiver: r.user_profiles.payout_paypal_email,
        note: `Troll City Weekly Payout - Week Ending ${batch.week_end}`,
        sender_item_id: r.id,
      }));

    if (items.length === 0) {
      throw new Error("No valid PayPal emails found in batch");
    }

    const payload = {
      sender_batch_header: {
        sender_batch_id: `batch_${batchId}_${Date.now()}`,
        email_subject: "You have a payout from Troll City!",
        email_message: "Congratulations! You've received your weekly payout from Troll City, including any seasonal bonuses earned.",
      },
      items: items,
    };

    // 6. Send Payout to PayPal
    const payoutResp = await fetch(`${baseUrl}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const payoutData = await payoutResp.json();

    if (!payoutResp.ok) {
      throw new Error(`PayPal Payout API Error: ${JSON.stringify(payoutData)}`);
    }

    const paypalBatchId = payoutData.batch_header.payout_batch_id;

    // 7. Update Database
    // Mark batch as processing
    await supabaseClient
      .from("payout_batches")
      .update({ 
        status: "processing",
        updated_at: new Date().toISOString()
      })
      .eq("id", batchId);

    // Update requests with payment reference
    const { error: updateError } = await supabaseClient
      .from("payout_requests")
      .update({ 
        status: "processing",
        payment_reference: paypalBatchId,
        processed_by: user.id
      })
      .eq("batch_id", batchId)
      .eq("status", "pending");

    if (updateError) console.error("Error updating requests:", updateError);

    return new Response(JSON.stringify({ 
      success: true, 
      paypalBatchId,
      processedCount: items.length
    }), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("PayPal Batch Process Failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
