import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hype Mode - activates when a stock has sudden activity spike
async function activateHypeMode(supabase: any, stockId: string) {
  const HYPE_DURATION_MINUTES = 10;
  
  await supabase
    .from("stocks")
    .update({
      is_hyped: true,
      hype_ends_at: new Date(Date.now() + HYPE_DURATION_MINUTES * 60 * 1000).toISOString()
    })
    .eq("id", stockId);
}

// Deactivate Hype Mode
async function deactivateHypeMode(supabase: any, stockId: string) {
  await supabase
    .from("stocks")
    .update({
      is_hyped: false,
      hype_ends_at: null
    })
    .eq("id", stockId);
}

// Crash System - reduce price for inactive stocks
async function processCrashSystem(supabase: any) {
  const CRASH_THRESHOLD_HOURS = 1; // 1 hour of inactivity
  const CRASH_RATE = 0.05; // 5% drop per hour

  // Get settings
  const { data: settings } = await supabase
    .from("stock_market_settings")
    .select("value")
    .in("key", ["crash_threshold_inactivity", "crash_rate_per_hour"]);

  const threshold = settings?.find((s: any) => s.key === "crash_threshold_inactivity")?.value || "3600";
  const rate = settings?.find((s: any) => s.key === "crash_rate_per_hour")?.value || "5";

  // Find inactive stocks
  const { data: inactiveStocks } = await supabase
    .from("stocks")
    .select("*")
    .eq("is_active", true)
    .eq("is_hyped", false)
    .lt("last_updated", new Date(Date.now() - parseInt(threshold) * 1000).toISOString());

  for (const stock of inactiveStocks || []) {
    const hoursInactive = (Date.now() - new Date(stock.last_updated).getTime()) / (1000 * 60 * 60);
    const crashAmount = Math.min(0.5, hoursInactive * (parseFloat(rate) / 100)); // Max 50% crash
    
    const newPrice = Math.max(1, stock.current_price * (1 - crashAmount));
    
    await supabase
      .from("stocks")
      .update({
        current_price: newPrice,
        price_change_24h: newPrice - stock.base_price,
        price_change_pct_24h: ((newPrice - stock.base_price) / stock.base_price) * 100
      })
      .eq("id", stock.id);
  }
}

// Update Leaderboards
async function updateLeaderboards(supabase: any) {
  // Get richest investors
  const { data: portfolios } = await supabase
    .from("user_portfolio")
    .select(`
      user_id,
      total_invested,
      shares,
      stocks!inner(current_price)
    `)
    .gt("shares", 0);

  // Calculate portfolio values per user
  const userValues: Record<string, number> = {};
  for (const p of portfolios || []) {
    const value = (p.shares || 0) * ((p.stocks as any)?.current_price || 0);
    userValues[p.user_id] = (userValues[p.user_id] || 0) + value;
  }

  // Sort and rank
  const sortedUsers = Object.entries(userValues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);

  // Update leaderboard
  for (let i = 0; i < sortedUsers.length; i++) {
    const [userId, value] = sortedUsers[i];
    
    await supabase
      .from("stock_leaderboards")
      .upsert({
        leaderboard_type: "richest_investor",
        user_id: userId,
        value: value,
        rank: i + 1,
        period: "all_time",
        calculated_at: new Date().toISOString()
      }, {
        onConflict: "leaderboard_type,user_id,period"
      });
  }

  // Get top gainers (stocks with highest 24h change)
  const { data: topGainers } = await supabase
    .from("stocks")
    .select("id, name, stock_symbol, price_change_pct_24h")
    .eq("is_active", true)
    .order("price_change_pct_24h", { ascending: false })
    .limit(10);

  // Store top gainers in a separate table or settings
  if (topGainers && topGainers.length > 0) {
    await supabase
      .from("stock_market_settings")
      .upsert({
        key: "top_gainers",
        value: JSON.stringify(topGainers),
        description: "Top performing stocks by 24h change",
        updated_at: new Date().toISOString()
      }, {
        onConflict: "key"
      });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const action = req.url.searchParams.get("action") || "process";

    switch (action) {
      case "hype":
        // Activate hype for a stock
        const { stock_id } = await req.json();
        if (!stock_id) throw new Error("stock_id required");
        
        await activateHypeMode(supabase, stock_id);
        
        // Schedule deactivation
        setTimeout(async () => {
          await deactivateHypeMode(supabase, stock_id);
        }, 10 * 60 * 1000); // 10 minutes

        return new Response(
          JSON.stringify({ success: true, message: "Hype mode activated" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "crash":
        await processCrashSystem(supabase);
        
        return new Response(
          JSON.stringify({ success: true, message: "Crash system processed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "leaderboards":
        await updateLeaderboards(supabase);
        
        return new Response(
          JSON.stringify({ success: true, message: "Leaderboards updated" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "process":
      default:
        // Run all gamification processes
        await processCrashSystem(supabase);
        await updateLeaderboards(supabase);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Gamification processes completed" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
