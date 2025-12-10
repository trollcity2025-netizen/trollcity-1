// TrollTract Activation Edge Function
// Purpose: Handle TrollTract contract activation with 20,000 coin deduction

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ActivateRequest {
  user_id: string;
}

interface ActivateResponse {
  success?: boolean;
  error?: string;
  message?: string;
  current_coins?: number;
  required_coins?: number;
  activation_date?: string;
  remaining_coins?: number;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const requestData: ActivateRequest = await req.json();
    const { user_id } = requestData;

    if (!user_id) {
      const errorResponse: ActivateResponse = { 
        error: "MISSING_USER_ID",
        message: "User ID is required" 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user already has TrollTract activated
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("is_trolltract, trolltract_activated_at")
      .eq("id", user_id)
      .single();

    if (existingProfile?.is_trolltract) {
      const errorResponse: ActivateResponse = { 
        error: "ALREADY_ACTIVATED",
        message: "TrollTract is already activated for this account" 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check wallet for sufficient coins
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("paid_coins")
      .eq("user_id", user_id)
      .single();

    // If wallets table doesn't exist, try user_profiles
    let currentCoins = 0;
    if (walletError || !wallet) {
      const { data: profileWallet } = await supabase
        .from("user_profiles")
        .select("paid_coin_balance")
        .eq("id", user_id)
        .single();
      
      currentCoins = profileWallet?.paid_coin_balance || 0;
    } else {
      currentCoins = wallet.paid_coins || 0;
    }

    // Check if user has enough coins
    if (currentCoins < 20000) {
      const errorResponse: ActivateResponse = { 
        error: "NOT_ENOUGH_COINS",
        message: `You need 20,000 Troll Coins to activate TrollTract. You currently have ${currentCoins.toLocaleString()}.`,
        current_coins: currentCoins,
        required_coins: 20000
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Start transaction-like operations
    const activationTime = new Date().toISOString();

    // 1. Deduct coins from wallet
    const newCoinBalance = currentCoins - 20000;
    
    // Update wallets table if it exists
    const { error: walletUpdateError } = await supabase
      .from("wallets")
      .update({ paid_coins: newCoinBalance })
      .eq("user_id", user_id);

    // Also update user_profiles as fallback
    const { error: profileUpdateError } = await supabase
      .from("user_profiles")
      .update({ paid_coin_balance: newCoinBalance })
      .eq("id", user_id);

    // 2. Activate TrollTract contract
    const { error: trolltractError } = await supabase
      .from("user_profiles")
      .update({
        is_trolltract: true,
        trolltract_activated_at: activationTime
      })
      .eq("id", user_id);

    if (trolltractError) {
      console.error("TrollTract activation error:", trolltractError);
      
      // Rollback coin deduction if TrollTract activation fails
      await supabase
        .from("user_profiles")
        .update({ paid_coin_balance: currentCoins })
        .eq("id", user_id);

      const errorResponse: ActivateResponse = { 
        error: "ACTIVATION_FAILED",
        message: "Failed to activate TrollTract. Please try again." 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Log the activation for audit trail
    const { error: logError } = await supabase
      .from("trolltract_bonus_log")
      .insert({
        user_id: user_id,
        base_amount: 0,
        bonus_amount: 0,
        total_amount: 0,
        gift_id: null,
        stream_id: null,
        sender_id: null
      });

    if (logError) {
      console.warn("Failed to log TrollTract activation:", logError);
      // Don't fail the whole operation for logging error
    }

    // 4. Create initial analytics record
    const { error: analyticsError } = await supabase
      .from("trolltract_analytics")
      .upsert({
        user_id: user_id,
        date: new Date().toISOString().split('T')[0],
        total_gifts: 0,
        trolltract_bonus: 0,
        total_earnings: 0,
        unique_gifters: 0
      });

    if (analyticsError) {
      console.warn("Failed to create initial analytics:", analyticsError);
    }

    // Success response
    const successResponse: ActivateResponse = { 
      success: true,
      message: "TrollTract activated successfully! You now have access to creator features and 10% bonus earnings.",
      activation_date: activationTime,
      remaining_coins: newCoinBalance
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("TrollTract activation error:", error);
    
    const errorResponse: ActivateResponse = { 
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again." 
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});