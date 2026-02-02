import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

// Response type definition
interface AdminStatsResponse {
  success: boolean;
  data: {
    users: {
      totalUsers: number;
      adminsCount: number;
      pendingApps: number;
      pendingPayouts: number;
      trollOfficers: number;
      aiFlags: number;
    };
    economy: {
      coinSalesRevenue: number;
      totalPayouts: number;
      feesCollected: number;
      platformProfit: number;
      purchasedCoins: number;
      earnedCoins: number;
      freeCoins: number;
      totalCoinsInCirculation: number;
      totalValue: number;
      giftCoins: number;
      appSponsoredGifts: number;
    };
    financial: {
      total_liability_coins: number;
      total_platform_profit_usd: number;
      kick_ban_revenue: number;
    };
    lastUpdated: string;
  };
  error?: string;
}

// Generic query result type
interface QueryResult<T> {
  data: T | null;
  error: any;
}

// Helper to safely execute a query and return null on table not found
async function safeQuery<T>(
  queryFn: () => Promise<QueryResult<T>>
): Promise<T | null> {
  try {
    const result = await queryFn();
    if (result.error) {
      // If table doesn't exist (PGRST116 = relation not found), return null
      if (result.error.code === "PGRST116") {
        console.warn("Table or view not found for query");
        return null;
      }
      // Log other errors but don't fail
      console.error("Query error:", result.error.message);
      return null;
    }
    return result.data;
  } catch (err) {
    console.error("Query execution error:", err);
    return null;
  }
}

// Count helper
function count(data: any[] | null): number {
  return data?.length || 0;
}

// Sum helper for numeric fields
function sum(data: any[] | null, field: string): number {
  if (!data) return 0;
  return data.reduce((acc: number, item: any) => acc + (Number(item[field]) || 0), 0);
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { prepare: false },
    }
  );

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // ========== USER STATS ==========
    const [totalUsersData, adminsData, pendingAppsData, pendingPayoutsData, trollOfficersData, aiFlagsData]:
      [any[] | null, any[] | null, any[] | null, any[] | null, any[] | null, any[] | null] =
      await Promise.all([
        safeQuery(() => supabase.from("profiles").select("id") as Promise<QueryResult<any>>),
        safeQuery(() => supabase.from("profiles").select("id").eq("role", "admin") as Promise<QueryResult<any>>),
        safeQuery(() => supabase.from("applications").select("id").eq("status", "pending") as Promise<QueryResult<any>>),
        safeQuery(() => supabase.from("payout_requests").select("id").eq("status", "pending") as Promise<QueryResult<any>>),
        safeQuery(() => supabase.from("profiles").select("id").eq("role", "troll_officer") as Promise<QueryResult<any>>),
        safeQuery(() => supabase.from("admin_flags").select("id").eq("detected_by", "ai") as Promise<QueryResult<any>>),
      ]);

    // ========== ECONOMY STATS ==========
    // Coin sales revenue from paypal_transactions or coin_transactions
    const coinSalesData = await safeQuery(() =>
      supabase
        .from("coin_transactions")
        .select("metadata, platform_profit")
        .eq("type", "purchase") as Promise<QueryResult<any>>
    );

    // Total payouts from earnings_payouts
    const payoutsData = await safeQuery(() =>
      supabase.from("earnings_payouts").select("amount, status") as Promise<QueryResult<any>>
    );

    // Fees collected from payout_requests
    const feesData = await safeQuery(() =>
      supabase.from("payout_requests").select("processing_fee") as Promise<QueryResult<any>>
    );

    // Purchased coins
    const purchasedCoinsData = await safeQuery(() =>
      supabase.from("coin_transactions").select("amount").eq("type", "purchase") as Promise<QueryResult<any>>
    );

    // Earned coins (from various earning activities - NOT HARDCODED)
    const earnedCoinsData = await safeQuery(() =>
      supabase
        .from("coin_transactions")
        .select("amount")
        .in("type", ["earning", "post_earning", "reward", "battle_reward", "referral_bonus"]) as Promise<QueryResult<any>>
    );

    // Free coins distributed
    const freeCoinsData = await safeQuery(() =>
      supabase.from("coin_transactions").select("amount").eq("type", "free") as Promise<QueryResult<any>>
    );

    // Total coins in circulation (sum of all user balances)
    const circulationData = await safeQuery(() =>
      supabase.from("profiles").select("coins_balance, troll_coins") as Promise<QueryResult<any>>
    );

    // Gift coins given
    const giftCoinsData = await safeQuery(() =>
      supabase.from("coin_transactions").select("amount").eq("type", "gift") as Promise<QueryResult<any>>
    );

    // App-sponsored gifts
    const appSponsoredGiftsData = await safeQuery(() =>
      supabase.from("coin_transactions").select("amount").eq("type", "app_gift") as Promise<QueryResult<any>>
    );

    // SAV promo count
    const savPromoData = await safeQuery(() =>
      supabase.from("sav_promotions").select("id") as Promise<QueryResult<any>>
    );

    // ========== FINANCIAL STATS ==========
    // Total liability coins (sum of all user coin balances - NOT HARDCODED)
    const liabilityData = await safeQuery(() =>
      supabase.from("profiles").select("coins_balance, troll_coins") as Promise<QueryResult<any>>
    );

    // Platform profit in USD from transactions
    const platformProfitData = await safeQuery(() =>
      supabase
        .from("coin_transactions")
        .select("platform_profit_usd")
        .not("platform_profit_usd", "is", null) as Promise<QueryResult<any>>
    );

    // Kick/ban revenue (NOT HARDCODED) - from punishment fines
    const kickBanRevenueData = await safeQuery(() =>
      supabase
        .from("punishment_fines")
        .select("amount")
        .in("fine_type", ["kick", "ban", "temp_ban"]) as Promise<QueryResult<any>>
    );

    // ========== CALCULATE VALUES ==========

    // Coin sales revenue calculation
    let coinSalesRevenue = 0;
    const coinTx = coinSalesData || [];
    for (const t of coinTx) {
      const profit = Number(t.platform_profit || 0);
      if (profit > 0) {
        coinSalesRevenue += profit;
      } else {
        const meta = t.metadata || {};
        const amountPaid = Number(meta.amount_paid || 0);
        if (!isNaN(amountPaid)) coinSalesRevenue += amountPaid;
      }
    }

    // Total payouts (only paid/approved ones)
    const payouts = payoutsData || [];
    const totalPayouts = payouts
      .filter((p: any) => p.status === "paid" || p.status === "approved")
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    // Fees collected
    const fees = feesData || [];
    const feesCollected = sum(fees, "processing_fee");

    // Platform profit
    const platformProfit = coinSalesRevenue - totalPayouts - feesCollected;

    // Purchased coins
    const purchasedCoins = sum(purchasedCoinsData, "amount");

    // Earned coins
    const earnedCoins = sum(earnedCoinsData, "amount");

    // Free coins
    const freeCoins = sum(freeCoinsData, "amount");

    // Total coins in circulation
    const circulation = circulationData || [];
    const totalCoinsInCirculation = circulation.reduce(
      (sum: number, p: any) => sum + (Number(p.coins_balance) || 0) + (Number(p.troll_coins) || 0),
      0
    );

    // Total value (USD) - assuming 100 coins = $1 USD
    const totalValue = totalCoinsInCirculation / 100;

    // Gift coins
    const giftCoins = sum(giftCoinsData, "amount");

    // App-sponsored gifts
    const appSponsoredGifts = sum(appSponsoredGiftsData, "amount");

    // Total liability coins
    const liability = liabilityData || [];
    const total_liability_coins = liability.reduce(
      (sum: number, p: any) => sum + (Number(p.coins_balance) || 0) + (Number(p.troll_coins) || 0),
      0
    );

    // Platform profit in USD
    const total_platform_profit_usd = sum(platformProfitData, "platform_profit_usd");

    // Kick/ban revenue
    const kick_ban_revenue = sum(kickBanRevenueData, "amount");

    // ========== BUILD RESPONSE ==========
    const response: AdminStatsResponse = {
      success: true,
      data: {
        users: {
          totalUsers: count(totalUsersData),
          adminsCount: count(adminsData),
          pendingApps: count(pendingAppsData),
          pendingPayouts: count(pendingPayoutsData),
          trollOfficers: count(trollOfficersData),
          aiFlags: count(aiFlagsData),
        },
        economy: {
          coinSalesRevenue,
          totalPayouts,
          feesCollected,
          platformProfit,
          purchasedCoins,
          earnedCoins, // NOT HARDCODED - calculated from coin_transactions
          freeCoins,
          totalCoinsInCirculation,
          totalValue,
          giftCoins,
          appSponsoredGifts,
          savPromoCount,
        },
        financial: {
          total_liability_coins, // NOT HARDCODED - calculated from profiles
          total_platform_profit_usd,
          kick_ban_revenue, // NOT HARDCODED - from punishment_fines
        },
        lastUpdated: new Date().toISOString(),
      },
    };

    // Cache-control: cache for 30 seconds
    const headers = {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error("admin-stats error:", err);

    const errorResponse: AdminStatsResponse = {
      success: false,
      data: {
        users: {
          totalUsers: 0,
          adminsCount: 0,
          pendingApps: 0,
          pendingPayouts: 0,
          trollOfficers: 0,
          aiFlags: 0,
        },
        economy: {
          coinSalesRevenue: 0,
          totalPayouts: 0,
          feesCollected: 0,
          platformProfit: 0,
          purchasedCoins: 0,
          earnedCoins: 0,
          freeCoins: 0,
          totalCoinsInCirculation: 0,
          totalValue: 0,
          giftCoins: 0,
          appSponsoredGifts: 0,
        },
        financial: {
          total_liability_coins: 0,
          total_platform_profit_usd: 0,
          kick_ban_revenue: 0,
        },
        lastUpdated: new Date().toISOString(),
      },
      error: err?.message || "Failed to fetch admin stats",
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
