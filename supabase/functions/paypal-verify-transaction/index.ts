import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

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

    if (!orderId) {
      throw new Error("Missing orderId");
    }

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
      console.error("PayPal token error (verify):", text);
      throw new Error("Failed to authenticate with PayPal");
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string;

    const orderRes = await fetch(
      `${baseUrl}/v2/checkout/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!orderRes.ok) {
      const text = await orderRes.text();
      console.error("PayPal get order error:", text);
      throw new Error("Failed to fetch PayPal order");
    }

    const orderData: any = await orderRes.json();

    const purchaseUnit = orderData?.purchase_units?.[0] ?? null;

    const amountValue: string = purchaseUnit?.amount?.value ?? "0";
    const currencyCode: string = purchaseUnit?.amount?.currency_code ?? "USD";

    const payerEmail: string | null =
      orderData?.payer?.email_address ?? null;

    const result = {
      success: true,
      orderId,
      status: orderData?.status ?? null,
      amount: parseFloat(amountValue || "0"),
      currency: currencyCode,
      payerEmail,
      raw: {
        id: orderData?.id ?? null,
        intent: orderData?.intent ?? null,
        createTime: orderData?.create_time ?? null,
        updateTime: orderData?.update_time ?? null,
      },
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("paypal-verify-transaction error:", error);

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

