import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Penalty map based on severity
const penaltyMap: Record<string, number> = {
  minor: 100,
  moderate: 500,
  severe: 1500,
  critical: 3000,
  wipeout: -1 // Special: means total wipe
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify user is admin or judge
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", authUser.user.id)
      .single();

    if (!profile || (profile.role !== "admin" && !profile.is_admin)) {
      return new Response("Admin access required", { status: 403 });
    }

    const { appealId, userId, verdict, severity } = await req.json();

    if (!userId || !verdict || !severity) {
      return new Response("Missing required fields", { status: 400 });
    }

    let coinsToDeduct: number;

    if (severity === "wipeout") {
      // Get user's current balance
      const { data: user } = await supabase
        .from("user_profiles")
        .select("free_coin_balance")
        .eq("id", userId)
        .single();

      coinsToDeduct = user?.free_coin_balance || 0; // Wipe all
    } else {
      coinsToDeduct = penaltyMap[severity] || 0;
    }

    if (coinsToDeduct <= 0 && severity !== "wipeout") {
      return new Response("Invalid severity level", { status: 400 });
    }

    // Call SQL function to deduct coins
    const { data: result, error: deductError } = await supabase.rpc("deduct_user_coins", {
      p_user_id: userId,
      p_amount: coinsToDeduct,
      p_reason: `Trial Verdict: ${verdict}`,
      p_appeal_id: appealId || null,
      p_verdict: verdict
    });

    if (deductError) {
      console.error("Error deducting coins:", deductError);
      return new Response("Failed to apply punishment", { status: 500 });
    }

    return new Response(JSON.stringify({
      success: true,
      deducted: coinsToDeduct,
      remaining: result?.remaining || 0
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in apply-punishment:", e);
    return new Response("Server error", { status: 500 });
  }
});

