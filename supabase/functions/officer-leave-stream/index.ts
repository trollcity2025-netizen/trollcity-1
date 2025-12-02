import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Officer pay rates (must match frontend)
const OFFICER_HOURLY_COINS: Record<number, number> = {
  1: 500,   // Junior
  2: 800,   // Senior
  3: 1200   // Commander
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
      console.error("Auth error:", authError);
      return new Response("Unauthorized", { status: 401 });
    }

    const officerId = authUser.user.id;
    const { streamId } = await req.json();

    if (!streamId) {
      return new Response("Missing streamId", { status: 400 });
    }

    const now = new Date().toISOString();

    // Update assignment to mark as left
    await supabase
      .from("officer_live_assignments")
      .update({ 
        status: "left", 
        left_at: now 
      })
      .match({ 
        officer_id: officerId, 
        stream_id: streamId, 
        status: "active" 
      });

    // Find and close the open work session
    const { data: session, error: sessionError } = await supabase
      .from("officer_work_sessions")
      .select("id, clock_in, officer_id")
      .is("clock_out", null)
      .eq("officer_id", officerId)
      .eq("stream_id", streamId)
      .order("clock_in", { ascending: false })
      .limit(1)
      .single();

    if (session && !sessionError) {
      // Get officer level
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("officer_level")
        .eq("id", officerId)
        .single();

      const officerLevel = profile?.officer_level || 1;
      const hourlyRate = OFFICER_HOURLY_COINS[officerLevel] || OFFICER_HOURLY_COINS[1];

      // Calculate hours worked
      const clockIn = new Date(session.clock_in);
      const clockOut = new Date(now);
      const hoursWorked = Math.max(0.1, (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60));
      const coinsEarned = Math.round(hoursWorked * hourlyRate);

      // Update work session
      await supabase
        .from("officer_work_sessions")
        .update({
          clock_out: now,
          hours_worked: hoursWorked,
          coins_earned: coinsEarned
        })
        .eq("id", session.id);

      // Add coins to user's free_coin_balance
      const { data: currentProfile } = await supabase
        .from("user_profiles")
        .select("free_coin_balance")
        .eq("id", officerId)
        .single();

      const currentBalance = currentProfile?.free_coin_balance || 0;
      await supabase
        .from("user_profiles")
        .update({
          free_coin_balance: currentBalance + coinsEarned
        })
        .eq("id", officerId);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in officer-leave-stream:", e);
    return new Response("Server error", { status: 500 });
  }
});

