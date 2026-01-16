import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import Stripe from "https://cdn.skypack.dev/stripe@14.25.0?min";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY");
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
    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Missing STRIPE_SECRET_KEY" }), {
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
    const action = body?.action as string | undefined;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "create-setup-intent") {
      const customerId = await getOrCreateCustomer(authData.user.id);

      const intent = await stripe.setupIntents.create({
        customer: customerId,
        usage: "off_session",
      });

      return new Response(JSON.stringify({ clientSecret: intent.client_secret }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "save-payment-method") {
      const paymentMethodId = body?.paymentMethodId as string | undefined;
      if (!paymentMethodId) {
        return new Response(JSON.stringify({ error: "Missing paymentMethodId" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const customerId = await getOrCreateCustomer(authData.user.id);

      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      if (!paymentMethod?.customer || paymentMethod.customer !== customerId) {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      }

      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      await supabaseAdmin
        .from("user_payment_methods")
        .update({ is_default: false })
        .eq("user_id", authData.user.id);

      const card = (paymentMethod as Stripe.PaymentMethod).card;
      const displayName = card
        ? `${String(card.brand || "Card").toUpperCase()} •••• ${card.last4 || ""}`
        : paymentMethod?.type || "payment_method";

      const { data: savedMethod, error: saveError } = await supabaseAdmin
        .from("user_payment_methods")
        .upsert({
          user_id: authData.user.id,
          provider: "stripe",
          token_id: paymentMethodId,
          display_name: displayName,
          brand: card?.brand || null,
          last4: card?.last4 || null,
          exp_month: card?.exp_month || null,
          exp_year: card?.exp_year || null,
          stripe_customer_id: customerId,
          stripe_payment_method_id: paymentMethodId,
          is_default: true,
        }, { onConflict: "user_id,provider,token_id" })
        .select()
        .single();

      if (saveError) {
        console.error("save-payment-method error", saveError);
        return new Response(JSON.stringify({ error: "Failed to save payment method" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, method: savedMethod }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-payment-method") {
      const id = body?.id as string | undefined;
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: method, error: methodError } = await supabaseAdmin
        .from("user_payment_methods")
        .select("id, user_id, stripe_payment_method_id")
        .eq("id", id)
        .single();

      if (methodError || !method) {
        return new Response(JSON.stringify({ error: "Payment method not found" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (method.user_id !== authData.user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (method.stripe_payment_method_id) {
        await stripe.paymentMethods.detach(method.stripe_payment_method_id);
      }

      const { error: deleteError } = await supabaseAdmin
        .from("user_payment_methods")
        .delete()
        .eq("id", id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: "Failed to delete payment method" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "set-default-payment-method") {
      const id = body?.id as string | undefined;
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: method, error: methodError } = await supabaseAdmin
        .from("user_payment_methods")
        .select("id, user_id, stripe_payment_method_id, stripe_customer_id")
        .eq("id", id)
        .single();

      if (methodError || !method) {
        return new Response(JSON.stringify({ error: "Payment method not found" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (method.user_id !== authData.user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (method.stripe_customer_id && method.stripe_payment_method_id) {
        await stripe.customers.update(method.stripe_customer_id, {
          invoice_settings: { default_payment_method: method.stripe_payment_method_id },
        });
      }

      await supabaseAdmin
        .from("user_payment_methods")
        .update({ is_default: false })
        .eq("user_id", authData.user.id);

      const { error: updateError } = await supabaseAdmin
        .from("user_payment_methods")
        .update({ is_default: true })
        .eq("id", id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Failed to set default" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Stripe payment method error", err);
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
