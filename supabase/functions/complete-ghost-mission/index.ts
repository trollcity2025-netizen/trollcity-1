import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Mission rewards
const MISSION_REWARDS: Record<string, { coins: number; reputation: number }> = {
  silent_watch: { coins: 300, reputation: 5 },
  shadow_defender: { coins: 500, reputation: 10 },
  stealth_patrol_elite: { coins: 1000, reputation: 20 }
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

    const officerId = authUser.user.id;
    const { missionType, streamId } = await req.json();

    if (!missionType || !MISSION_REWARDS[missionType]) {
      return new Response("Invalid mission type", { status: 400 });
    }

    const rewards = MISSION_REWARDS[missionType];

    // Log mission completion
    const { error: logError } = await supabase
      .from("officer_mission_logs")
      .insert({
        officer_id: officerId,
        mission_type: missionType,
        stream_id: streamId || null,
        coins_awarded: rewards.coins,
        reputation_awarded: rewards.reputation
      });

    if (logError) {
      console.error("Error logging mission:", logError);
      return new Response("Failed to log mission", { status: 500 });
    }

    // Award coins and reputation
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("free_coin_balance, officer_reputation_score")
      .eq("id", officerId)
      .single();

    const currentBalance = profile?.free_coin_balance || 0;
    const currentRep = profile?.officer_reputation_score || 100;

    await supabase
      .from("user_profiles")
      .update({
        free_coin_balance: currentBalance + rewards.coins,
        officer_reputation_score: Math.min(200, currentRep + rewards.reputation)
      })
      .eq("id", officerId);

    return new Response(JSON.stringify({
      success: true,
      coinsAwarded: rewards.coins,
      reputationAwarded: rewards.reputation
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in complete-ghost-mission:", e);
    return new Response("Server error", { status: 500 });
  }
});

