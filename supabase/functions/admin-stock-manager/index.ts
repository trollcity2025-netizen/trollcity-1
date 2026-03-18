import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin/CEO
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin" || profile?.is_admin === true;

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const action = req.url.searchParams.get("action") || "list";

    switch (action) {
      case "list":
        // Get all stocks including inactive
        const { data: stocks, error: stocksError } = await supabase
          .from("stocks")
          .select("*")
          .order("created_at", { ascending: false });

        if (stocksError) throw stocksError;

        return new Response(
          JSON.stringify({ success: true, stocks }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "create": {
        const { stock_symbol, name, type, entity_id, base_price, description } = await req.json();

        if (!stock_symbol || !name || !type) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: stock_symbol, name, type" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if symbol exists
        const { data: existing } = await supabase
          .from("stocks")
          .select("id")
          .eq("stock_symbol", stock_symbol)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({ error: "Stock symbol already exists" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const price = base_price || 100;
        const marketCap = price * 1000000;

        const { data: newStock, error: createError } = await supabase
          .from("stocks")
          .insert({
            stock_symbol,
            name,
            type,
            entity_id: entity_id || null,
            base_price: price,
            current_price: price,
            previous_price: price,
            market_cap: marketCap,
            description: description || null
          })
          .select()
          .single();

        if (createError) throw createError;

        // Create initial price history
        await supabase
          .from("stock_price_history")
          .insert({
            stock_id: newStock.id,
            price: price,
            volume: 0,
            activity_score: 0
          });

        return new Response(
          JSON.stringify({ success: true, stock: newStock }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        const { stock_id, base_price, volatility, is_active, is_hyped, hype_minutes } = await req.json();

        if (!stock_id) {
          return new Response(
            JSON.stringify({ error: "stock_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateData: Record<string, any> = {};

        if (base_price !== undefined) updateData.base_price = base_price;
        if (volatility !== undefined) updateData.volatility = volatility;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (is_hyped !== undefined) {
          updateData.is_hyped = is_hyped;
          if (is_hyped && hype_minutes) {
            updateData.hype_ends_at = new Date(Date.now() + hype_minutes * 60 * 1000).toISOString();
          } else if (!is_hyped) {
            updateData.hype_ends_at = null;
          }
        }

        const { data: updatedStock, error: updateError } = await supabase
          .from("stocks")
          .update(updateData)
          .eq("id", stock_id)
          .select()
          .single();

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ success: true, stock: updatedStock }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        const { stock_id } = await req.json();

        if (!stock_id) {
          return new Response(
            JSON.stringify({ error: "stock_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Soft delete - just mark as inactive
        const { error: deleteError } = await supabase
          .from("stocks")
          .update({ is_active: false })
          .eq("id", stock_id);

        if (deleteError) throw deleteError;

        return new Response(
          JSON.stringify({ success: true, message: "Stock deactivated" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "activate_hype": {
        const { stock_id, minutes } = await req.json();

        if (!stock_id) {
          return new Response(
            JSON.stringify({ error: "stock_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const hypeMinutes = minutes || 10;
        const { data: hypedStock, error: hypeError } = await supabase
          .from("stocks")
          .update({
            is_hyped: true,
            hype_ends_at: new Date(Date.now() + hypeMinutes * 60 * 1000).toISOString()
          })
          .eq("id", stock_id)
          .select()
          .single();

        if (hypeError) throw hypeError;

        return new Response(
          JSON.stringify({ success: true, stock: hypedStock }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "deactivate_hype": {
        const { stock_id } = await req.json();

        if (!stock_id) {
          return new Response(
            JSON.stringify({ error: "stock_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: dehyphedStock, error: dehypeError } = await supabase
          .from("stocks")
          .update({
            is_hyped: false,
            hype_ends_at: null
          })
          .eq("id", stock_id)
          .select()
          .single();

        if (dehypeError) throw dehypeError;

        return new Response(
          JSON.stringify({ success: true, stock: dehyphedStock }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "leaderboards": {
        // Get richest investors
        const { data: portfolios } = await supabase
          .from("user_portfolio")
          .select("user_id, shares, total_invested")
          .gt("shares", 0);

        const userValues: Record<string, number> = {};
        
        if (portfolios && portfolios.length > 0) {
          const stockIds = [...new Set(portfolios.map(p => {
            // We need to get the stock price separately
            return null;
          }))];

          for (const p of portfolios) {
            userValues[p.user_id] = (userValues[p.user_id] || 0) + Number(p.total_invested);
          }
        }

        const sortedUsers = Object.entries(userValues)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 100);

        const leaderboardData = sortedUsers.map(([userId, value], index) => ({
          user_id: userId,
          value,
          rank: index + 1
        }));

        return new Response(
          JSON.stringify({ success: true, leaderboards: leaderboardData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
