import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import Stripe from "https://cdn.skypack.dev/stripe@14.25.0?min";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

if (!STRIPE_WEBHOOK_SECRET) {
  console.error("Missing STRIPE_WEBHOOK_SECRET");
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500, headers: cors });
    }

    const signatureHeader = req.headers.get("stripe-signature") || "";
    const payload = await req.text();

    const event = stripe.webhooks.constructEvent(payload, signatureHeader, STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id as string;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
      const purchaseType = session?.metadata?.purchase_type as string | undefined;

      const { data: order, error: orderError } = await supabaseAdmin
        .from("coin_orders")
        .select("id, user_id, coins, status")
        .eq("stripe_checkout_session_id", sessionId)
        .single();

      if (orderError || !order) {
        console.warn("Order not found for session", sessionId, orderError?.message);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (order.status !== "paid" && order.status !== "fulfilled") {
        const { error: updateError } = await supabaseAdmin
          .from("coin_orders")
          .update({
            status: "paid",
            stripe_payment_intent_id: paymentIntentId,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("Failed to mark order paid", updateError);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
      }

      if (purchaseType === "troll_pass_bundle") {
        const { error: passError } = await supabaseAdmin.rpc("apply_troll_pass_bundle", {
          p_user_id: order.user_id,
        });

        if (passError) {
          console.error("apply_troll_pass_bundle failed", passError);
        }

        const { error: fulfillError } = await supabaseAdmin
          .from("coin_orders")
          .update({
            status: "fulfilled",
            fulfilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (fulfillError) {
          console.error("Failed to fulfill troll pass order", fulfillError);
        }
      } else {
        const { error: creditError } = await supabaseAdmin.rpc("credit_coins", {
          p_user_id: order.user_id,
          p_coins: order.coins,
          p_order_id: order.id,
        });

        if (creditError) {
          console.error("credit_coins failed", creditError);
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const paymentIntentId = paymentIntent.id as string;
      const metadata = paymentIntent.metadata || {};
      const purchaseType = metadata.purchase_type as string | undefined;
      const orderId = metadata.order_id as string | undefined;

      let orderQuery = supabaseAdmin
        .from("coin_orders")
        .select("id, user_id, coins, status")
        .eq("stripe_payment_intent_id", paymentIntentId);

      if (orderId) {
        orderQuery = orderQuery.eq("id", orderId);
      }

      const { data: order, error: orderError } = await orderQuery.maybeSingle();

      if (orderError || !order) {
        console.warn("Order not found for payment_intent", paymentIntentId, orderError?.message);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (order.status !== "paid" && order.status !== "fulfilled") {
        const { error: updateError } = await supabaseAdmin
          .from("coin_orders")
          .update({
            status: "paid",
            stripe_payment_intent_id: paymentIntentId,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("Failed to mark order paid", updateError);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
      }

      if (purchaseType === "troll_pass_bundle") {
        const { error: passError } = await supabaseAdmin.rpc("apply_troll_pass_bundle", {
          p_user_id: order.user_id,
        });

        if (passError) {
          console.error("apply_troll_pass_bundle failed", passError);
        }

        const { error: fulfillError } = await supabaseAdmin
          .from("coin_orders")
          .update({
            status: "fulfilled",
            fulfilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (fulfillError) {
          console.error("Failed to fulfill troll pass order", fulfillError);
        }
      } else {
        const { error: creditError } = await supabaseAdmin.rpc("credit_coins", {
          p_user_id: order.user_id,
          p_coins: order.coins,
          p_order_id: order.id,
        });

        if (creditError) {
          console.error("credit_coins failed", creditError);
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Stripe webhook error", err);
    return new Response(`Webhook Error: ${err?.message || "Unknown error"}`,
      { status: 400, headers: cors },
    );
  }
});
