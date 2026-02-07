import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Rate Limit Check
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  // Use anon key for rate limiting if preferred, but service role works too. 
  // Just reusing existing client.
  const { data: allowed, error: rateError } = await supabase.rpc('check_rate_limit', {
    p_key: `paypal_complete_${ip}`,
    p_limit: 10, // 10 attempts per minute
    p_window_seconds: 60
  });

  if (rateError) console.error('Rate limit error:', rateError);
  if (!allowed) {
    return new Response(
      JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const orderId: string | undefined = body?.orderId ?? body?.orderID;
    const userId: string | undefined = body?.userId ?? body?.user_id;
    const packageId: string | undefined = body?.packageId ?? body?.package_id;

    if (!orderId || !userId) {
      throw new Error("Missing required fields: orderId and userId");
    }

    // 0. Check if order already processed
    const { data: existingTx } = await supabase
      .from("paypal_transactions")
      .select("*")
      .eq("paypal_order_id", orderId)
      .maybeSingle();

    if (existingTx && existingTx.status === "credited") {
      return new Response(JSON.stringify({
        success: true,
        coinsAdded: existingTx.coins,
        alreadyProcessed: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Verify and capture payment with PayPal
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
    const isSandbox = Deno.env.get("PAYPAL_MODE") === "sandbox";
    const baseUrl = isSandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials not configured");
    }

    const auth = btoa(`${clientId}:${clientSecret}`);

    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("PayPal token error:", text);
      throw new Error("Failed to authenticate with PayPal");
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string;

    // Fetch order first
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });
    if (!orderRes.ok) {
      const text = await orderRes.text();
      console.error("PayPal get order error:", text);
      throw new Error("Failed to fetch PayPal order");
    }

    let orderData: any = await orderRes.json();
    let status: string = orderData?.status ?? "";

    // Capture only if approved
    if (status === "APPROVED") {
      const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });

      if (!captureRes.ok) {
        const text = await captureRes.text();
        console.error("PayPal capture error:", text);

        let errorMessage = "Failed to capture PayPal order";
        try {
          const jsonError = JSON.parse(text);
          const details = jsonError.details?.[0];
          if (details?.issue === "INSTRUMENT_DECLINED") {
            errorMessage = "Payment declined by bank. Please check your funds or try another card.";
          } else if (jsonError.name === "UNPROCESSABLE_ENTITY") {
            errorMessage = "Payment could not be processed. Please try again.";
          }
        } catch {
          // Keep default error
        }

        return new Response(JSON.stringify({
          success: false,
          error: errorMessage,
          paypal_details: text,
          orderId,
          mode: Deno.env.get("PAYPAL_MODE"),
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      orderData = await captureRes.json();
      status = orderData?.status ?? "";
    }

    // Accept already completed
    const completed =
      status === "COMPLETED" ||
      orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.status === "COMPLETED";

    if (!completed) {
      throw new Error(`Payment not completed (status: ${status || "unknown"})`);
    }

    const capture =
      orderData?.purchase_units?.[0]?.payments?.captures?.[0] ?? null;

    const captureId: string | null = capture?.id ?? null;

    const amountValueString: string =
      capture?.amount?.value ??
      orderData?.purchase_units?.[0]?.amount?.value ??
      "0";

    const verifiedAmount = parseFloat(amountValueString || "0");
    const verifiedCurrency: string =
      capture?.amount?.currency_code ??
      orderData?.purchase_units?.[0]?.amount?.currency_code ??
      "USD";

    // 2. Determine how many coins to credit
    let coinsToCredit = 0;
    let dbItem = null;

    if (packageId) {
      // Look up in purchasable_items (Centralized Inventory)
      const { data: item, error: itemError } = await supabase
        .from("purchasable_items")
        .select("*")
        .eq("id", packageId)
        .maybeSingle();

      if (itemError) {
         console.error("purchasable_items lookup error:", itemError);
      }
      
      if (item) {
        dbItem = item;
        coinsToCredit = item.metadata?.coins || 0;
      } else if (String(packageId).startsWith("custom_")) {
        // Keep custom logic for manual/special flows if needed
        const parts = String(packageId).split("_");
        const raw = parts[1];
        const parsed = raw ? parseInt(raw, 10) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) {
          coinsToCredit = parsed;
        }
      } else {
        // Fallback to old table for backward compatibility if needed, 
        // but ideally we should only use purchasable_items now.
        // For safety during migration, we can check coin_packages.
         const { data: pkg, error: pkgError } = await supabase
          .from("coin_packages")
          .select("coins")
          .eq("id", packageId)
          .maybeSingle();
          
         if (pkg?.coins) {
           coinsToCredit = pkg.coins;
         }
      }
    }

    if (!coinsToCredit || coinsToCredit <= 0) {
      console.error(`Invalid package/coins for ID: ${packageId}`);
      throw new Error("Could not determine coin amount for package");
    }

    // 2.5 Record successful capture in paypal_transactions (Legacy/Audit)
    await supabase.from("paypal_transactions").upsert({
      user_id: userId,
      paypal_order_id: orderId,
      paypal_capture_id: captureId,
      amount: verifiedAmount,
      currency: verifiedCurrency,
      coins: coinsToCredit,
      status: "completed"
    });

    // 2.6 Record in purchase_ledger (Revenue Sync - Single Source of Truth)
    if (dbItem) {
        await supabase.from("purchase_ledger").insert({
          user_id: userId,
          item_id: dbItem.id,
          usd_amount: verifiedAmount,
          coin_amount: coinsToCredit,
          payment_method: 'card', // PayPal counts as 'card' or external
          source_context: 'CoinStore',
          metadata: { 
             paypal_order_id: orderId,
             paypal_capture_id: captureId,
             paypal_status: status
          }
        });
    } else {
        // If it was a custom/legacy package not in purchasable_items, 
        // we might skip ledger or insert with null item_id (if allowed) 
        // or create a placeholder. For now, strict enforcement implies we skip 
        // if not in inventory, but we don't want to lose revenue data.
        // But the schema requires item_id.
        console.warn(`Purchase ${orderId} has no purchasable_item match. Ledger skipped.`);
    }

    // 3. Credit coins using Troll Bank (handles ledger + repayment)
    const refId = captureId || orderId;

    const { data: bankResult, error: bankError } = await supabase.rpc(
      "troll_bank_credit_coins",
      {
        p_user_id: userId,
        p_coins: coinsToCredit,
        p_bucket: "paid",
        p_source: "paypal_purchase",
        p_ref_id: refId,
      },
    );

    if (bankError) {
      console.error("troll_bank_credit_coins error:", bankError);
      throw new Error(bankError.message || "Failed to credit coins");
    }

    // 4. Mark transaction as credited
    await supabase
      .from("paypal_transactions")
      .update({ status: "credited" })
      .eq("paypal_order_id", orderId);

    const userGets =
      bankResult && typeof bankResult.user_gets === "number"
        ? bankResult.user_gets
        : coinsToCredit;

    const responseBody = {
      success: true,
      coinsAdded: userGets,
      repay: bankResult?.repay ?? 0,
      newLoanBalance: bankResult?.new_loan_balance ?? null,
      loanStatus: bankResult?.loan_status ?? null,
      paypal: {
        orderId,
        captureId,
        amount: verifiedAmount,
        currency: verifiedCurrency,
        status,
      },
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("paypal-complete-order error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

