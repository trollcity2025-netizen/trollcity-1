import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Stock {
  id: string;
  stock_symbol: string;
  type: string;
  entity_id: string | null;
  base_price: number;
  current_price: number;
  previous_price: number;
  price_change_24h: number;
  price_change_pct_24h: number;
  volume: number;
  market_cap: number;
  high_24h: number;
  low_24h: number;
  volatility: number;
  is_hyped: boolean;
  hype_ends_at: string | null;
  last_updated: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active stocks
    const { data: stocks, error: stocksError } = await supabase
      .from("stocks")
      .select("*")
      .eq("is_active", true);

    if (stocksError) throw stocksError;

    const updatedStocks = [];

    // Get 7-day average prices for soft floor calculation
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: priceHistory } = await supabase
      .from("stock_price_history")
      .select("stock_id, price")
      .gte("recorded_at", sevenDaysAgo);
    
    // Calculate 7-day averages
    const avgPrices = new Map<string, number>();
    if (priceHistory) {
      const stockPrices = new Map<string, number[]>();
      for (const ph of priceHistory) {
        if (!stockPrices.has(ph.stock_id)) {
          stockPrices.set(ph.stock_id, []);
        }
        stockPrices.get(ph.stock_id)!.push(ph.price);
      }
      for (const [stockId, prices] of stockPrices) {
        if (prices.length > 0) {
          avgPrices.set(stockId, prices.reduce((a, b) => a + b, 0) / prices.length);
        }
      }
    }

    for (const stock of stocks || []) {
      // ===== STEP 1: Calculate Activity Score (35% weight) =====
      let activityScoreFactor = 0; // Normalized 0-1 factor
      let activityScore = 0;

      if (stock.type === "creator") {
        // Get creator stats
        const { data: creatorStats } = await supabase
          .from("streams")
          .select("viewer_count, gifts_received, started_at")
          .eq("user_id", stock.entity_id)
          .eq("is_live", true)
          .maybeSingle();

        // Get battle stats
        const { data: battleStats } = await supabase
          .from("battles")
          .select("winner_id")
          .eq("streamer_id", stock.entity_id)
          .gte("created_at", sevenDaysAgo);
        
        const battlesWon = battleStats?.filter(b => b.winner_id === stock.entity_id).length || 0;

        if (creatorStats) {
          const streamDuration = creatorStats.started_at 
            ? (Date.now() - new Date(creatorStats.started_at).getTime()) / (1000 * 60 * 60) // hours
            : 0;
          
          activityScore = 
            (creatorStats.viewer_count || 0) * 2 +
            (creatorStats.gifts_received || 0) * 5 +
            streamDuration * 1.5 +
            battlesWon * 10;
          
          // Normalize: assume 1000 viewers, 100 gifts, 5 hours, 10 battles = max activity
          activityScoreFactor = Math.min(1, activityScore / 3500);
        }
      } else if (stock.type === "family") {
        // Get family stats
        const { data: familyStats } = await supabase
          .from("troll_families")
          .select("xp, member_count, total_assets")
          .eq("id", stock.entity_id)
          .maybeSingle();

        if (familyStats) {
          activityScore = 
            (familyStats.xp || 0) * 0.01 +
            (familyStats.member_count || 0) * 3 +
            (familyStats.total_assets || 0) * 0.1;
          
          // Normalize: assume 10000 XP, 50 members, 10000 assets = max
          activityScoreFactor = Math.min(1, activityScore / 400);
        }
      } else if (stock.type === "property") {
        // Get property usage stats
        const { data: propertyUsage } = await supabase
          .from("property_usage")
          .select("daily_usage")
          .eq("property_id", stock.entity_id)
          .gte("recorded_at", sevenDaysAgo);
        
        const totalUsage = propertyUsage?.reduce((sum, p) => sum + (p.daily_usage || 0), 0) || 0;
        activityScore = totalUsage;
        activityScoreFactor = Math.min(1, activityScore / 1000);
      }

      // ===== STEP 2: Calculate Demand Pressure (25% weight) =====
      // Get recent trading activity
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentTrades } = await supabase
        .from("stock_transactions")
        .select("transaction_type, shares")
        .eq("stock_id", stock.id)
        .gte("created_at", oneHourAgo);
      
      let sharesBought = 0;
      let sharesSold = 0;
      
      if (recentTrades) {
        for (const trade of recentTrades) {
          if (trade.transaction_type === "buy") {
            sharesBought += parseFloat(trade.shares.toString());
          } else {
            sharesSold += parseFloat(trade.shares.toString());
          }
        }
      }
      
      // Total shares in market cap (estimated)
      const totalShares = stock.market_cap / stock.current_price || 1;
      let demandPressure = (sharesBought - sharesSold) / totalShares;
      // Clamp between -0.05 and +0.05 to prevent manipulation
      demandPressure = Math.max(-0.05, Math.min(0.05, demandPressure));

      // ===== STEP 3: Calculate Hype Multiplier (20% weight) =====
      let hypeMultiplier = 0;
      
      if (stock.is_hyped && stock.hype_ends_at) {
        const hypeEndTime = new Date(stock.hype_ends_at).getTime();
        const now = Date.now();
        
        if (hypeEndTime > now) {
          // Calculate remaining hype (0.2 to 0.5 boost)
          const remainingRatio = (hypeEndTime - now) / (10 * 60 * 1000); // 10 min duration
          hypeMultiplier = 0.2 + (remainingRatio * 0.3);
        }
      }
      
      // Check for viral events (recent high activity)
      if (activityScoreFactor > 0.7) {
        hypeMultiplier = Math.max(hypeMultiplier, 0.15);
      }

      // ===== STEP 4: Market Growth Bias (10% weight) =====
      // Constant small upward pressure (0.01-0.03) - ensures most users see growth
      const marketGrowthBias = 0.01 + (Math.random() * 0.02);

      // ===== STEP 5: Random Volatility (10% weight) =====
      const randomVolatility = (Math.random() - 0.5) * 2; // -1 to 1
      const volatilityEffect = randomVolatility * stock.volatility * 0.1;

      // ===== STEP 6: Calculate New Price =====
      // New formula with growth-biased multiplier
      const multiplier = 1 + 
        (activityScoreFactor * 0.35) +
        (demandPressure * 0.25) +
        (hypeMultiplier * 0.20) +
        (marketGrowthBias * 0.10) +
        volatilityEffect;
      
      let newPrice = stock.current_price * multiplier;
      
      // ===== STEP 7: Anti-Loss Mechanisms =====
      
      // Max drop per update: -5%
      const maxDrop = stock.current_price * 0.05;
      if (newPrice < stock.current_price - maxDrop) {
        newPrice = stock.current_price - maxDrop;
      }
      
      // Soft floor: price cannot fall below 60-70% of 7-day average
      const sevenDayAvg = avgPrices.get(stock.id) || stock.base_price;
      const floorPrice = sevenDayAvg * 0.65; // 65% of 7-day average
      if (newPrice < floorPrice) {
        // Auto-recovery boost - reduce the drop
        newPrice = floorPrice;
      }
      
      // Minimum price is $1
      newPrice = Math.max(1, newPrice);
      newPrice = Math.round(newPrice * 100) / 100;
      
      // Calculate price changes
      const priceChange = newPrice - stock.current_price;
      const priceChangePct = stock.current_price > 0 
        ? (priceChange / stock.current_price) * 100 
        : 0;

      // ===== STEP 8: Update Stock =====
      const { error: updateError } = await supabase
        .from("stocks")
        .update({
          previous_price: stock.current_price,
          current_price: newPrice,
          price_change_24h: stock.price_change_24h + priceChange,
          price_change_pct_24h: stock.price_change_pct_24h + priceChangePct,
          activity_score: activityScore,
          demand_factor: 1 + demandPressure,
          high_24h: Math.max(stock.high_24h, newPrice),
          low_24h: Math.min(stock.low_24h, newPrice),
          volume: stock.volume + Math.floor(sharesBought + sharesSold),
          last_updated: new Date().toISOString()
        })
        .eq("id", stock.id);

      if (!updateError) {
        // Record price history
        await supabase
          .from("stock_price_history")
          .insert({
            stock_id: stock.id,
            price: newPrice,
            volume: Math.floor(sharesBought + sharesSold),
            activity_score: activityScore
          });

        updatedStocks.push(stock.stock_symbol);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updatedStocks.length} stocks`,
        stocks: updatedStocks
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
