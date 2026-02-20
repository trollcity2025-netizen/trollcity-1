import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const nonce = body?.nonce ?? null;
    const productType = body?.productType ?? body?.type ?? 'coin_pack';
    const productId = body?.productId ?? body?.packId ?? body?.packageId ?? null;

    if (!productId || !nonce) {
      return new Response(JSON.stringify({ error: "Missing productId (packId) or nonce" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Authenticate user via incoming bearer token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return new Response(JSON.stringify({ error: "Missing auth token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userId = authData.user.id;

    let amount = 0;
    let coinAmount = 0;
    let packId = productId;

    if (productType === 'coin_pack') {
      // Lookup pack
      const { data: pack, error: packErr } = await supabase
        .from("coin_packs")
        .select("id, usd_amount, coin_amount, active")
        .eq("id", productId)
        .maybeSingle();

      if (packErr || !pack) {
        return new Response(JSON.stringify({ error: "Pack not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!pack.active) {
        return new Response(JSON.stringify({ error: "Pack not active" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      amount = Number(pack.usd_amount || 0);
      coinAmount = Number(pack.coin_amount || 0);
      packId = pack.id;

      if (!amount || amount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid pack amount" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (productType === 'troll_pass') {
      // For troll_pass products we may not have a coin price; accept price override or default
      amount = Number(body?.amount || body?.usd_amount || 0);
      coinAmount = Number(body?.coins || 0);
      packId = productId;
      if (!amount || amount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid troll_pass amount" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unsupported productType" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call Braintree Transactions API
    const BT_MERCHANT_ID = Deno.env.get("BT_MERCHANT_ID") || "";
    const BT_PUBLIC_KEY = Deno.env.get("BT_PUBLIC_KEY") || "";
    const BT_PRIVATE_KEY = Deno.env.get("BT_PRIVATE_KEY") || "";
    const BT_ENV = (Deno.env.get("BT_ENV") || "sandbox").toLowerCase();
    if (!BT_MERCHANT_ID || !BT_PUBLIC_KEY || !BT_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "Braintree not configured in Edge Function secrets" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const gatewayHost = BT_ENV === "production" ? "api.braintreegateway.com" : "api.sandbox.braintreegateway.com";
    const txUrl = `https://${gatewayHost}/merchants/${BT_MERCHANT_ID}/transactions`;

    const auth = btoa(`${BT_PUBLIC_KEY}:${BT_PRIVATE_KEY}`);
    const amountStr = (Math.round(amount * 100) / 100).toFixed(2);

    const txPayload: any = {
      transaction: {
        amount: amountStr,
        payment_method_nonce: nonce,
        options: { submit_for_settlement: true },
        custom_fields: { pack_id: String(packId) }
      }
    };

    const txRes = await fetch(txUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(txPayload),
    });

    const txText = await txRes.text();
    let txJson: any = null;
    try { txJson = JSON.parse(txText); } catch { txJson = { raw: txText }; }

    if (!txRes.ok) {
      console.error("Braintree transaction error", txText);
      return new Response(JSON.stringify({ success: false, error: "Payment failed", details: txJson }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const transaction = txJson?.transaction ?? null;
    const txId = transaction?.id ?? null;
    const txStatus = transaction?.status ?? null;

    const successStatuses = ["submitted_for_settlement", "settling", "settled", "authorized", "settlement_pending"];
    const succeeded = txId && successStatuses.includes(String(txStatus).toLowerCase());

    if (!succeeded) {
      return new Response(JSON.stringify({ success: false, error: "Transaction not successful", details: transaction }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotency: attempt insert; if unique violation, don't double credit
    const insertPayload: any = {
      user_id: userId,
      pack_id: packId,
      transaction_id: txId,
      usd_amount: amount,
      coin_amount: coinAmount,
      status: 'succeeded',
      provider: 'braintree',
      payment_method_type: transaction?.paymentInstrumentType ?? null,
      created_at: new Date().toISOString()
    };

    const { data: insertData, error: insertErr } = await supabase
      .from("coin_purchases")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (insertErr) {
      // If unique violation on transaction_id, return current balance
      console.warn("coin_purchases insert error", insertErr);
      // Try detect duplicate via requesting existing row
      const { data: existing } = await supabase
        .from("coin_purchases")
        .select("id")
        .eq("transaction_id", txId)
        .maybeSingle();

      if (existing) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("coin_balance")
          .eq("user_id", userId)
          .maybeSingle();

        return new Response(JSON.stringify({ success: true, transactionId: txId, newBalance: wallet?.coin_balance ?? null, alreadyProcessed: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: false, error: insertErr.message || insertErr }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Post-transaction handling
    if (insertErr) {
      // If unique violation on transaction_id, return current balance
      console.warn("coin_purchases insert error", insertErr);
      const { data: existing } = await supabase
        .from("coin_purchases")
        .select("id")
        .eq("transaction_id", txId)
        .maybeSingle();

      if (existing) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("coin_balance")
          .eq("user_id", userId)
          .maybeSingle();

        return new Response(JSON.stringify({ success: true, transactionId: txId, newBalance: wallet?.coin_balance ?? null, alreadyProcessed: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: false, error: insertErr.message || insertErr }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If coin pack, credit coins via Troll Bank RPC (idempotent)
    if (productType === 'coin_pack') {
      const { data: bankResult, error: bankError } = await supabase.rpc("troll_bank_credit_coins", {
        p_user_id: userId,
        p_coins: coinAmount,
        p_bucket: 'paid',
        p_source: 'braintree_purchase',
        p_ref_id: txId,
      });

      if (bankError) console.error("troll_bank_credit_coins error", bankError);

      const { data: walletAfter } = await supabase
        .from("wallets")
        .select("coin_balance")
        .eq("user_id", userId)
        .maybeSingle();

      return new Response(JSON.stringify({ success: true, transactionId: txId, newBalance: walletAfter?.coin_balance ?? null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If troll_pass, apply entitlement RPC and update profile stats
    if (productType === 'troll_pass') {
      try {
        const { error: tpErr } = await supabase.rpc('apply_troll_pass_bundle', { p_user_id: userId });
        if (tpErr) console.error('apply_troll_pass_bundle error', tpErr);

        // Update profile stats similar to manual flow
        const { data: profileRow } = await supabase
          .from('user_profiles')
          .select('paid_coins, total_earned_coins')
          .eq('id', userId)
          .maybeSingle();

        const currentPaid = profileRow?.paid_coins ?? 0;
        const currentEarned = profileRow?.total_earned_coins ?? 0;
        const { error: profileUpdateError } = await supabase
          .from('user_profiles')
          .update({
            paid_coins: currentPaid + (coinAmount || 0),
            total_earned_coins: currentEarned + (coinAmount || 0),
          })
          .eq('id', userId);

        if (profileUpdateError) console.error('profile update error', profileUpdateError);

        const { data: wallet } = await supabase
          .from('wallets')
          .select('coin_balance')
          .eq('user_id', userId)
          .maybeSingle();

        return new Response(JSON.stringify({ success: true, transactionId: txId, newBalance: wallet?.coin_balance ?? null, entitlement: 'troll_pass' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err: any) {
        console.error('troll_pass post success error', err);
        return new Response(JSON.stringify({ success: true, transactionId: txId, message: 'Transaction succeeded but post-processing had errors' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

  } catch (err: any) {
    console.error("braintree-checkout error", err);
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
