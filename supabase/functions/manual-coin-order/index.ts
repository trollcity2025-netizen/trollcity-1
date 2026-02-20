import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders as cors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_KEY = Deno.env.get("MANUAL_ORDERS_ADMIN_KEY") || "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isValidUUID = (id: string | null | undefined): boolean => {
  if (!id) return false;
  return UUID_REGEX.test(id);
};

const validateAndNormalizeHandle = (provider: string, raw: string | undefined | null) => {
  const handle = (raw ?? "").trim();
  if (!handle) {
    return { tag: null, error: "Handle cannot be empty." };
  }

  switch (provider) {
    case 'cashapp':
      if (!/^\$[A-Za-z0-9_]{1,20}$/.test(handle)) {
        return { tag: null, error: "Invalid Cash App Cashtag. It must start with '$' and contain letters, numbers, or underscores." };
      }
      return { tag: handle };
    case 'venmo':
      if (!/^@[A-Za-z0-9\-]{3,30}$/.test(handle)) {
        return { tag: null, error: "Invalid Venmo handle. It must start with '@' and contain letters, numbers, or hyphens." };
      }
      return { tag: handle };
    case 'paypal':
      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(handle)) {
        return { tag: null, error: "Invalid PayPal email address." };
      }
      return { tag: handle };
    default:
      return { tag: null, error: "Unsupported payment provider." };
  }
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
      // Rate Limit Check (Server-Side)
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
      const rateKey = `manual_payment:${authData.user.id}:${clientIp}`;
      
      // Check limit: 1 request per 60 seconds
      const { data: allowed, error: rateError } = await supabaseAdmin.rpc('check_rate_limit', {
        p_key: rateKey,
        p_limit: 1,
        p_window_seconds: 60
      });

      if (rateError) {
        console.error("Rate limit check failed", rateError);
        // Fail open or closed? Let's fail closed for security.
        return new Response(JSON.stringify({ error: "Rate limit check failed" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (!allowed) {
        return new Response(JSON.stringify({ error: "Please wait 60 seconds before making another request." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const pkg = body?.package || {};
      const coins = Number(pkg?.coins || 0);
      const amountUsd = Number(pkg?.price || 0);

      const packageId = body?.package_id ?? pkg?.id ?? null;
      const purchaseType = body?.purchase_type || 'manual_cashapp';
      let paymentMethod = 'cashapp';
      if (purchaseType.includes('venmo')) paymentMethod = 'venmo';
      if (purchaseType.includes('paypal')) paymentMethod = 'paypal';

      const { tag: payerId, error: tagError } = validateAndNormalizeHandle(paymentMethod, body?.payer_id);

      if (tagError) {
        return new Response(JSON.stringify({ error: tagError }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (!coins || !amountUsd) {
        return new Response(JSON.stringify({ error: "Missing coins or amount" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      
      const providerId = body?.provider_id as string | undefined;
      if (!providerId) {
        return new Response(JSON.stringify({ error: "Missing payment provider ID" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      // Verify user profile exists (user_id in manual_coin_orders references user_profiles.id)
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("id, username")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError || !userProfile) {
        return new Response(JSON.stringify({ error: "User profile not found" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const amount_cents = Math.round(amountUsd * 100);
      const username = body?.username ?? userProfile.username ?? authData.user.user_metadata?.username ?? authData.user.email?.split("@")[0] ?? "user";
      const email = authData.user.email || "";
      const usernamePrefix = String(username).slice(0, 6).toUpperCase();
      const noteSuggested = `${usernamePrefix}-${coins}`;
      
      const purchaseType = body?.purchase_type || 'manual_cashapp';
      let paymentMethod = 'cashapp';
      if (purchaseType.includes('venmo')) paymentMethod = 'venmo';
      if (purchaseType.includes('paypal')) paymentMethod = 'paypal';

      const finalPackageId = isValidUUID(packageId) ? packageId : null;

      const { data: order, error } = await supabaseAdmin
        .from("manual_coin_orders")
        .insert({
          user_id: authData.user.id,
          package_id: finalPackageId,
          coins,
          amount_cents,
          note_suggested: noteSuggested,
          provider_id: providerId, // formerly cashapp_cashtag
          payer_id: payerId,       // new field for the user's payment identifier
          purchase_type: purchaseType,
          payment_method: paymentMethod,
          metadata: {
            username,
            email,
            package_name: pkg?.name,
            purchase_type: purchaseType,
            provider_id: providerId, // formerly cashapp_cashtag
            payer_id: payerId,       // new field for the user's payment identifier
            payment_method: paymentMethod
          },
        })
        .select("id, status, coins, amount_cents, note_suggested")
        .single();

      if (error || !order) {
        console.error("manual-coin-order insert error", error);
        return new Response(JSON.stringify({ error: error?.message || "Failed to create manual order" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }

      // Notify admins/secretaries
      try {
        const { data: adminUsers } = await supabaseAdmin
            .from('user_profiles')
            .select('id')
            .or('role.eq.admin,role.eq.secretary,is_admin.eq.true');
            
        if (adminUsers && adminUsers.length > 0) {
            const notifications = adminUsers.map(admin => ({
                user_id: admin.id,
                type: 'admin_alert',
                title: 'New Coin Order',
                message: `User ${username} ordered ${coins} coins via CashApp.`,
                metadata: { order_id: order.id, link: '/admin/manual-orders' }
            }));
            
            await supabaseAdmin.from('notifications').insert(notifications);
        }
      } catch (notifyError) {
        console.error('Failed to notify admins:', notifyError);
        // Continue, non-critical
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
        .maybeSingle();
      if (orderError || !order) {
        return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (order.status === "fulfilled") {
        const { data: walletRow } = await supabaseAdmin
          .from("wallets")
          .select("coin_balance")
          .eq("user_id", order.user_id)
          .maybeSingle();
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
          .maybeSingle();
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
          .select("paid_coins, total_earned_coins")
          .eq("id", order.user_id)
          .maybeSingle();
        const currentPaid = profileRow?.paid_coins ?? 0;
        const currentEarned = profileRow?.total_earned_coins ?? 0;
        
        // 1. Update stats (excluding troll_coins balance which is handled by Troll Bank)
        const { error: profileUpdateError } = await supabaseAdmin
          .from("user_profiles")
          .update({
            paid_coins: currentPaid + order.coins,
            total_earned_coins: currentEarned + order.coins,
          })
          .eq("id", order.user_id);
        
        if (profileUpdateError) {
          console.error("Fallback profile stats update error", profileUpdateError);
        }

        // 2. Credit coins via Troll Bank (handles repayment & ledger)
      const { error: bankError } = await supabaseAdmin.rpc('troll_bank_credit_coins', {
        p_user_id: order.user_id,
        p_coins: order.coins,
        p_bucket: 'paid',
        p_source: 'cashapp_manual',
        p_ref_id: order.id
      });

      if (bankError) {
         console.error("Troll Bank credit error", bankError);
         // If bank fails, we might want to alert, but we've already marked order as paid.
         // Ideally we should have done this first, but we are following the existing flow order.
      }
    }
    
    // Legacy transaction logging removed - Troll Bank coin_ledger is now the source of truth.
    
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

      const { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("coin_balance")
        .eq("user_id", order.user_id)
        .single();
      const newBalance = wallet?.coin_balance ?? 0;

      return new Response(JSON.stringify({ success: true, newBalance }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const orderId = body?.order_id as string | undefined;
      if (!orderId) return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

      const { data: order, error } = await supabaseAdmin
        .from("manual_coin_orders")
        .select("id, status, coins, amount_cents, paid_at, fulfilled_at, payer_cashtag")
        .eq("id", orderId)
        .maybeSingle();
      if (error || !order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, order }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const adminKey = req.headers.get("x-admin-key") || "";

      const { data: requesterProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("role, is_admin")
        .eq("id", authData.user.id)
        .maybeSingle();

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
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", rawOrderId);
      if (deleteError) {
        console.error("manual-coin-order delete (soft) error", deleteError);
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
