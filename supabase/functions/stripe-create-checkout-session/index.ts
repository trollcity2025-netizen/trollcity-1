import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_TROLL_PASS_PRICE_ID = Deno.env.get("STRIPE_TROLL_PASS_PRICE_ID");
const APP_URL = Deno.env.get("APP_URL");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY");
}

if (!APP_URL) {
  console.error("Missing APP_URL");
}

const supabaseAdmin = createClient(SUPABASE_URL ?? "", SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stripe = new Stripe(STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2023-10-16",
});

const getOrCreateCustomer = async (userId: string) => {
  const { data: existing } = await supabaseAdmin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    metadata: { user_id: userId },
  });

  const { error } = await supabaseAdmin
    .from("stripe_customers")
    .insert({ user_id: userId, stripe_customer_id: customer.id });

  if (error) {
    console.error("Failed to insert stripe_customer", error);
  }

  return customer.id as string;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    if (!STRIPE_SECRET_KEY || !APP_URL) {
      return new Response(JSON.stringify({ error: "Missing Stripe config" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const purchaseType = body?.purchaseType as string | undefined;
    const packageId = body?.packageId as string | undefined;
    const packageCoins = body?.coins as number | undefined;
    const packagePrice = body?.price as number | undefined;

    if (!packageId && purchaseType !== "troll_pass_bundle") {
      return new Response(JSON.stringify({ error: "Missing packageId" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const customerId = await getOrCreateCustomer(authData.user.id);

    if (purchaseType === "troll_pass_bundle") {
      if (!STRIPE_TROLL_PASS_PRICE_ID) {
        return new Response(JSON.stringify({ error: "Missing STRIPE_TROLL_PASS_PRICE_ID" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const price = await stripe.prices.retrieve(STRIPE_TROLL_PASS_PRICE_ID);
      const amountCents = typeof price.unit_amount === "number" ? price.unit_amount : 0;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${APP_URL}/wallet?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/wallet?canceled=1`,
        customer: customerId,
        client_reference_id: authData.user.id,
        line_items: [{ price: STRIPE_TROLL_PASS_PRICE_ID, quantity: 1 }],
        metadata: {
          user_id: authData.user.id,
          purchase_type: "troll_pass_bundle",
          coins: "1500",
        },
      });

      const { error: orderError } = await supabaseAdmin
        .from("coin_orders")
        .insert({
          user_id: authData.user.id,
          package_id: null,
          coins: 1500,
          amount_cents: amountCents,
          status: "created",
          stripe_checkout_session_id: session.id,
        });

      if (orderError) {
        console.error("Failed to insert troll pass order", orderError);
        return new Response(JSON.stringify({ error: "Failed to create order" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const isUuid = (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    let pkgQuery = supabaseAdmin
      .from("coin_packages")
      .select("id, coins, price_usd, amount_cents, stripe_price_id, is_active, paypal_sku")
      .eq("is_active", true);

    if (packageId) {
      pkgQuery = isUuid(packageId)
        ? pkgQuery.eq("id", packageId)
        : pkgQuery.eq("paypal_sku", packageId);
    } else if (typeof packageCoins === "number" && typeof packagePrice === "number") {
      pkgQuery = pkgQuery.eq("coins", packageCoins).eq("price_usd", packagePrice);
    }

    let { data: pkg, error: pkgError } = await pkgQuery.maybeSingle();

    if (pkgError && pkgError.message?.includes("is.not.null") && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const filterId = packageId && !isUuid(packageId)
        ? `paypal_sku=eq.${encodeURIComponent(packageId)}`
        : packageId
          ? `id=eq.${encodeURIComponent(packageId)}`
          : typeof packageCoins === "number" && typeof packagePrice === "number"
            ? `coins=eq.${packageCoins}&price_usd=eq.${packagePrice}`
            : "";
      const restUrl = `${SUPABASE_URL}/rest/v1/coin_packages?${filterId}&is_active=eq.true&stripe_price_id=is.not_null&select=id,coins,price_usd,amount_cents,stripe_price_id,is_active,paypal_sku`;
      const restRes = await fetch(restUrl, {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      });
      if (restRes.ok) {
        const rows = await restRes.json();
        pkg = Array.isArray(rows) ? rows[0] : null;
        pkgError = null as any;
      }
    }

    if (pkgError || !pkg) {
      return new Response(JSON.stringify({
        error: "Failed to fetch package",
        details: pkgError ? JSON.stringify(pkgError) : null,
      }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!pkg.is_active) {
      return new Response(JSON.stringify({ error: "Package inactive" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!pkg.stripe_price_id) {
      return new Response(JSON.stringify({ error: "Package missing stripe_price_id" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const amountCents = typeof pkg.amount_cents === "number"
      ? pkg.amount_cents
      : Math.round(Number(pkg.price_usd || 0) * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${APP_URL}/wallet?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/wallet?canceled=1`,
      customer: customerId,
      client_reference_id: authData.user.id,
      line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
      metadata: {
        user_id: authData.user.id,
        package_id: pkg.id,
        coins: String(pkg.coins ?? 0),
      },
    });

    const { error: orderError } = await supabaseAdmin
      .from("coin_orders")
      .insert({
        user_id: authData.user.id,
        package_id: pkg.id,
        coins: pkg.coins,
        amount_cents: amountCents,
        status: "created",
        stripe_checkout_session_id: session.id,
      });

    if (orderError) {
      console.error("Failed to insert coin_orders", orderError);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Stripe checkout error", err);
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
