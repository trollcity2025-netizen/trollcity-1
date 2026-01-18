import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_KEY = Deno.env.get("MANUAL_ORDERS_ADMIN_KEY") || "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalizeCashtag = (raw: string | undefined | null) => {
  const trimmed = (raw ?? "").trim();
  const withoutDollar = trimmed.replace(/^\$+/, "");
  if (!withoutDollar) return { tag: null, error: null };
  if (!/^[A-Za-z0-9._-]{1,30}$/.test(withoutDollar)) {
    return { tag: null, error: "Cash App tag must be 1-30 letters/numbers (no $)." };
  }
  return { tag: withoutDollar };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return new Response(JSON.stringify({ error: "Missing auth token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const action = body?.action as string | undefined;

    if (!action) return new Response(JSON.stringify({ error: "Missing action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    if (action === "create") {
      const pkg = body?.package;
      const coins = Number(body?.coins ?? pkg?.coins);
      const amountUsd = Number(body?.amount_usd ?? pkg?.price_usd);
      const packageId = body?.package_id ?? pkg?.id ?? null;
      const { tag: payerCashtag, error: tagError } = normalizeCashtag(body?.cashapp_tag ?? body?.cash_app_tag ?? body?.payer_cashtag);
      if (tagError) {
        return new Response(JSON.stringify({ error: tagError }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!coins || !amountUsd) {
        return new Response(JSON.stringify({ error: "Missing coins or amount" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      // Verify user profile exists (user_id in manual_coin_orders references user_profiles.id)
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("id, username")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !userProfile) {
        return new Response(JSON.stringify({ error: "User profile not found" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const amount_cents = Math.round(amountUsd * 100);
      const username = body?.username ?? userProfile.username ?? authData.user.user_metadata?.username ?? authData.user.email?.split("@")[0] ?? "user";
      const email = authData.user.email || "";
      const usernamePrefix = String(username).slice(0, 6).toUpperCase();
      const noteSuggested = `${usernamePrefix}-${coins}`;

      const { data: order, error } = await supabaseAdmin
        .from("manual_coin_orders")
        .insert({
          user_id: authData.user.id,
          package_id: packageId,
          coins,
          amount_cents,
          note_suggested: noteSuggested,
          payer_cashtag: payerCashtag || "unknown",
          metadata: {
            username,
            email,
            package_name: pkg?.name,
            purchase_type: body?.purchase_type ?? null,
            payer_cashtag: payerCashtag || "unknown",
          },
        })
        .select("id, status, coins, amount_cents, note_suggested")
        .single();

      if (error || !order) {
        console.error("manual-coin-order insert error", error);
        return new Response(JSON.stringify({ error: error?.message || "Failed to create manual order" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const instructions = {
        provider: "cashapp",
        cashtag: "$trollcity95",
        payer_cashtag: payerCashtag!,
        note: noteSuggested,
        message: "Send Cash App payment, include note with your username prefix and coins. Coins will be granted after verification.",
      };

      return new Response(JSON.stringify({ success: true, orderId: order.id, instructions }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "approve") {
      const adminKey = req.headers.get("x-admin-key") || "";

      const { data: requesterProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("role, is_admin")
        .eq("id", authData.user.id)
        .single();

      const isPrivileged =
        requesterProfile?.role === "admin" ||
        requesterProfile?.role === "secretary" ||
        requesterProfile?.is_admin === true ||
        (ADMIN_KEY && adminKey === ADMIN_KEY);
      if (!isPrivileged) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const rawOrderId = (body?.order_id as string | undefined)?.trim();
      if (!rawOrderId) {
        return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!/^[0-9a-fA-F-]{36}$/.test(rawOrderId)) {
        return new Response(JSON.stringify({ error: "Invalid order_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      let externalTxId = body?.external_tx_id as string | undefined;
      if (typeof externalTxId === "string") {
        externalTxId = externalTxId.trim();
        if (externalTxId.length === 0) {
          externalTxId = undefined;
        } else if (externalTxId.length > 128) {
          return new Response(JSON.stringify({ error: "external_tx_id too long" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
      } else {
        externalTxId = undefined;
      }

      const { data: order, error: orderError } = await supabaseAdmin
        .from("manual_coin_orders")
        .select("*")
        .eq("id", rawOrderId)
        .single();
      if (orderError || !order) {
        return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (order.status === "fulfilled") {
        const { data: walletRow } = await supabaseAdmin
          .from("wallets")
          .select("coin_balance")
          .eq("user_id", order.user_id)
          .single();
        const existingBalance = walletRow?.coin_balance ?? 0;
        return new Response(JSON.stringify({ success: true, newBalance: existingBalance }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (order.status !== "pending") {
        return new Response(JSON.stringify({ error: "Invalid status" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const nowIso = new Date().toISOString();
      const { error: markPaidError } = await supabaseAdmin
        .from("manual_coin_orders")
        .update({
          status: "paid",
          paid_at: nowIso,
          external_tx_id: externalTxId ?? order.external_tx_id,
          updated_at: nowIso,
        })
        .eq("id", rawOrderId);
      if (markPaidError) {
        console.error("Fallback mark paid error", markPaidError);
        return new Response(JSON.stringify({ error: "Approval failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      let newBalance = 0;
      const { data: walletExisting, error: walletSelectError } = await supabaseAdmin
        .from("wallets")
        .select("coin_balance")
        .eq("user_id", order.user_id)
        .single();
      if (walletSelectError || !walletExisting) {
        const { data: insertedWallet, error: walletInsertError } = await supabaseAdmin
          .from("wallets")
          .insert({
            user_id: order.user_id,
            coin_balance: order.coins,
          })
          .select("coin_balance")
          .single();
        if (walletInsertError || !insertedWallet) {
          console.error("Fallback wallet insert error", walletInsertError);
          return new Response(JSON.stringify({ error: "Approval failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
        newBalance = insertedWallet.coin_balance;
      } else {
        const { data: updatedWallet, error: walletUpdateError } = await supabaseAdmin
          .from("wallets")
          .update({
            coin_balance: walletExisting.coin_balance + order.coins,
          })
          .eq("user_id", order.user_id)
          .select("coin_balance")
          .single();
        if (walletUpdateError || !updatedWallet) {
          console.error("Fallback wallet update error", walletUpdateError);
          return new Response(JSON.stringify({ error: "Approval failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
        newBalance = updatedWallet.coin_balance;
      }
      const purchaseType = order.metadata?.purchase_type ?? "";
      if (purchaseType === "troll_pass") {
        const { error: trollPassError } = await supabaseAdmin.rpc("apply_troll_pass_bundle", {
          p_user_id: order.user_id,
        });
        if (trollPassError) {
          console.error("Fallback apply_troll_pass_bundle error", trollPassError);
        }
        const { data: profileRow } = await supabaseAdmin
          .from("user_profiles")
          .select("paid_coins, total_earned_coins")
          .eq("id", order.user_id)
          .single();
        const currentPaid = profileRow?.paid_coins ?? 0;
        const currentEarned = profileRow?.total_earned_coins ?? 0;
        const { error: profileUpdateError } = await supabaseAdmin
          .from("user_profiles")
          .update({
            paid_coins: currentPaid + order.coins,
            total_earned_coins: currentEarned + order.coins,
          })
          .eq("id", order.user_id);
        if (profileUpdateError) {
          console.error("Fallback profile troll_pass update error", profileUpdateError);
        }
      } else {
        const { data: profileRow } = await supabaseAdmin
          .from("user_profiles")
          .select("troll_coins, paid_coins, total_earned_coins")
          .eq("id", order.user_id)
          .single();
        const currentTroll = profileRow?.troll_coins ?? 0;
        const currentPaid = profileRow?.paid_coins ?? 0;
        const currentEarned = profileRow?.total_earned_coins ?? 0;
        const { error: profileUpdateError } = await supabaseAdmin
          .from("user_profiles")
          .update({
            troll_coins: currentTroll + order.coins,
            paid_coins: currentPaid + order.coins,
            total_earned_coins: currentEarned + order.coins,
          })
          .eq("id", order.user_id);
        if (profileUpdateError) {
          console.error("Fallback profile coin update error", profileUpdateError);
        }
      }
      const txMeta: Record<string, any> = {
        admin_id: authData.user.id,
        amount_cents: order.amount_cents,
      };
      if ((order as any).payer_cashtag) {
        txMeta.payer_cashtag = (order as any).payer_cashtag;
      }
      const { error: walletTxError } = await supabaseAdmin
        .from("wallet_transactions")
        .insert({
          user_id: order.user_id,
          type: "manual_purchase",
          currency: "troll_coins",
          amount: order.coins,
          reason: "Cash App purchase",
          source: "cashapp",
          reference_id: order.id,
          metadata: txMeta,
        });
      if (walletTxError) {
        console.error("Fallback wallet transaction error", walletTxError);
      }
      const coinTxMeta: Record<string, any> = {
        source: "cashapp_manual",
        order_id: order.id,
        amount_cents: order.amount_cents,
      };
      if ((order as any).payer_cashtag) {
        coinTxMeta.payer_cashtag = (order as any).payer_cashtag;
      }
      const { error: coinTxError } = await supabaseAdmin
        .from("coin_transactions")
        .insert({
          user_id: order.user_id,
          amount: order.coins,
          type: "store_purchase",
          description: "Manual Cash App purchase",
          metadata: coinTxMeta,
        });
      if (coinTxError) {
        console.error("Fallback coin transaction error", coinTxError);
      }
      const amountUsd = typeof order.amount_cents === "number" ? order.amount_cents / 100 : 0;
      const adminPoolCoinsRaw = amountUsd * 222.3;
      const adminPoolCoins = Math.round(adminPoolCoinsRaw);
      if (adminPoolCoins > 0) {
        const { data: poolRow, error: poolSelectError } = await supabaseAdmin
          .from("admin_pool")
          .select("id, trollcoins_balance")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (!poolSelectError && poolRow) {
          const currentBalance = Number((poolRow as any).trollcoins_balance || 0);
          const { error: poolUpdateError } = await supabaseAdmin
            .from("admin_pool")
            .update({
              trollcoins_balance: currentBalance + adminPoolCoins,
            })
            .eq("id", (poolRow as any).id);
          if (poolUpdateError) {
            console.error("manual-coin-order admin_pool update error", poolUpdateError);
          }
        } else if (poolSelectError && (poolSelectError as any).code !== "PGRST116") {
          console.error("manual-coin-order admin_pool select error", poolSelectError);
        }
      }
      const { error: notificationError } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: order.user_id,
          type: "system_update",
          title: "Cash App purchase completed",
          message: `You received ${order.coins} coins from your Cash App purchase.`,
          metadata: {
            source: "cashapp_manual",
            order_id: order.id,
            amount_cents: order.amount_cents,
            coins: order.coins,
            payer_cashtag: (order as any).payer_cashtag ?? null,
          },
          is_read: false,
          created_at: new Date().toISOString(),
        });
      if (notificationError) {
        console.error("manual-coin-order notification error", notificationError);
      }
      const { error: fulfillError } = await supabaseAdmin
        .from("manual_coin_orders")
        .update({
          status: "fulfilled",
          fulfilled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rawOrderId);
      if (fulfillError) {
        console.error("Fallback fulfill error", fulfillError);
      }
      return new Response(JSON.stringify({ success: true, newBalance }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const orderId = body?.order_id as string | undefined;
      if (!orderId) return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

      const { data: order, error } = await supabaseAdmin
        .from("manual_coin_orders")
        .select("id, status, coins, amount_cents, paid_at, fulfilled_at, payer_cashtag")
        .eq("id", orderId)
        .single();
      if (error || !order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, order }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const adminKey = req.headers.get("x-admin-key") || "";

      const { data: requesterProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("role, is_admin")
        .eq("id", authData.user.id)
        .single();

      const isPrivileged =
        requesterProfile?.role === "admin" ||
        requesterProfile?.role === "secretary" ||
        requesterProfile?.is_admin === true ||
        (ADMIN_KEY && adminKey === ADMIN_KEY);
      if (!isPrivileged) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const rawOrderId = (body?.order_id as string | undefined)?.trim();
      if (!rawOrderId) {
        return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!/^[0-9a-fA-F-]{36}$/.test(rawOrderId)) {
        return new Response(JSON.stringify({ error: "Invalid order_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const { error: deleteError } = await supabaseAdmin
        .from("manual_coin_orders")
        .delete()
        .eq("id", rawOrderId);
      if (deleteError) {
        console.error("manual-coin-order delete error", deleteError);
        return new Response(JSON.stringify({ error: deleteError.message || "Delete failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("manual-coin-order error", err);
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
