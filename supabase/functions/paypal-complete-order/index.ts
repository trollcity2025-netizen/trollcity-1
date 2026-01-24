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

  try {
    const body = await req.json();
    const orderId: string | undefined = body?.orderId ?? body?.orderID;
    const userId: string | undefined = body?.userId ?? body?.user_id;
    const packageId: string | undefined = body?.packageId ?? body?.package_id;

    if (!orderId || !userId) {
      throw new Error("Missing required fields: orderId and userId");
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

    const captureRes = await fetch(
      `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!captureRes.ok) {
      const text = await captureRes.text();
      console.error("PayPal capture error:", text);
      throw new Error("Failed to capture PayPal order");
    }

    const captureData: any = await captureRes.json();

    const status: string =
      captureData?.status ??
      captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.status ??
      "";

    if (status !== "COMPLETED") {
      throw new Error(`Payment not completed (status: ${status || "unknown"})`);
    }

    const capture =
      captureData?.purchase_units?.[0]?.payments?.captures?.[0] ?? null;

    const captureId: string | null = capture?.id ?? null;

    const amountValueString: string =
      capture?.amount?.value ??
      captureData?.purchase_units?.[0]?.amount?.value ??
      "0";

    const verifiedAmount = parseFloat(amountValueString || "0");
    const verifiedCurrency: string =
      capture?.amount?.currency_code ??
      captureData?.purchase_units?.[0]?.amount?.currency_code ??
      "USD";

    // 2. Determine how many coins to credit
    let coinsToCredit = 0;

    if (packageId) {
      if (String(packageId).startsWith("custom_")) {
        const parts = String(packageId).split("_");
        const raw = parts[1];
        const parsed = raw ? parseInt(raw, 10) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) {
          coinsToCredit = parsed;
        }
      } else {
        const { data: pkg, error: pkgError } = await supabase
          .from("coin_packages")
          .select("coins")
          .eq("id", packageId)
          .maybeSingle();

        if (pkgError) {
          console.error("coin_packages lookup error:", pkgError);
          throw new Error("Failed to load coin package");
        }

        if (!pkg?.coins || pkg.coins <= 0) {
          throw new Error("Invalid coin package");
        }

        coinsToCredit = pkg.coins;
      }
    }

    if (!coinsToCredit || coinsToCredit <= 0) {
      throw new Error("Could not determine coin amount for package");
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

