import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const config = {
  runtime: "edge",
  schedule: "0 20 * * 1,5", // Mondays and Fridays at 20:00 UTC (1 PM MST)
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let currentRunId = null;

  try {
    console.log("Starting payout process...");

    // 1. Prepare Payout Run (DB Transaction)
    // This creates the run, deducts coins, and returns the run ID.
    const { data: runId, error: runError } = await supabaseClient
      .rpc("prepare_payout_run");

    if (runError) throw new Error(`Prepare Run Error: ${runError.message}`);
    
    currentRunId = runId;

    if (!runId) {
      console.log("No eligible payouts found.");
      return new Response(JSON.stringify({ message: "No eligible payouts found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Run created: ${runId}`);

    // 2. Fetch Queued Payouts
    const { data: payouts, error: fetchError } = await supabaseClient
      .from("payouts")
      .select("*")
      .eq("run_id", runId)
      .eq("status", "queued");

    if (fetchError) throw new Error(`Fetch Payouts Error: ${fetchError.message}`);

    if (!payouts || payouts.length === 0) {
      console.log("Run created but no payouts queued (unexpected).");
      return new Response(JSON.stringify({ message: "Run created but no payouts queued", runId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${payouts.length} payouts...`);

    // 3. PayPal Integration
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const secret = Deno.env.get("PAYPAL_SECRET");
    const mode = Deno.env.get("PAYPAL_MODE") || "sandbox"; // sandbox or live
    const baseUrl = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    if (!clientId || !secret) {
      throw new Error("Missing PayPal credentials (PAYPAL_CLIENT_ID or PAYPAL_SECRET)");
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

    // Define the payout record type from the DB
    interface PayoutRecord {
      id: string;
      user_id: string;
      run_id: string;
      amount_usd: number;
      paypal_email: string;
      status: string;
      [key: string]: unknown;
    }
    
    interface PayoutItem {
      recipient_type: string;
      amount: { value: string; currency: string };
      receiver: string;
      note: string;
      sender_item_id: string;
    }
    
    // Construct Batch
    const items: PayoutItem[] = payouts.map((p: PayoutRecord) => ({
      recipient_type: "EMAIL",
      amount: {
        value: p.amount_usd.toString(),
        currency: "USD",
      },
      receiver: p.paypal_email,
      note: "Troll City Payout",
      sender_item_id: `${p.run_id}_${p.user_id}`, // Idempotency per run/user
    }));

    const payload = {
      sender_batch_header: {
        sender_batch_id: `batch_${runId}`,
        email_subject: "You have a payout from Troll City!",
        email_message: "Here are your earnings from Troll City. Keep trolling!",
      },
      items: items,
    };

    // Send Payout
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

    const batchId = payoutData.batch_header.payout_batch_id;
    console.log(`PayPal Batch Submitted: ${batchId}`);
      
    // Update Payouts to Processing
    const { error: updateError } = await supabaseClient
    .from("payouts")
    .update({ status: "processing", paypal_batch_id: batchId })
    .eq("run_id", runId);

    if (updateError) console.error("Error updating payout status:", updateError);

    // Update Run Status
    await supabaseClient
      .from("payout_runs")
      .update({
        status: "completed", // Batch submitted successfully
        paypal_batch_id: batchId,
        logs: payoutData,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return new Response(JSON.stringify({ 
      success: true, 
      runId, 
      payouts: payouts.length, 
      paypal_batch_id: batchId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Payout Process Failed:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Refund if run was created but failed before completion
    if (currentRunId) {
        console.log(`Attempting refund for run ${currentRunId}...`);
        const { error: refundError } = await supabaseClient.rpc("refund_payout_run", { p_run_id: currentRunId });
        if (refundError) {
            console.error("CRITICAL: Failed to refund payout run:", refundError);
        } else {
            console.log("Refund processed successfully.");
        }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
