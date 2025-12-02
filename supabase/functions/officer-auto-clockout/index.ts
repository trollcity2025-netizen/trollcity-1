import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Officer pay rates
const OFFICER_HOURLY_COINS: Record<number, number> = {
  1: 500,   // Junior
  2: 800,   // Senior
  3: 1200   // Commander
};

serve(async (req) => {
  // This function should only be called by Supabase cron
  // Optional: Add a secret token check if needed
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("X-Cron-Secret");
  
  if (cronSecret && providedSecret !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

    // Find all active assignments with no activity for 15+ minutes
    const { data: inactiveAssignments, error: fetchError } = await supabase
      .from("officer_live_assignments")
      .select("id, officer_id, stream_id, joined_at")
      .eq("status", "active")
      .lt("last_activity", fifteenMinutesAgo);

    if (fetchError) {
      console.error("Error fetching inactive assignments:", fetchError);
      return new Response("Error fetching assignments", { status: 500 });
    }

    if (!inactiveAssignments || inactiveAssignments.length === 0) {
      return new Response(JSON.stringify({ message: "No inactive officers found", processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const nowISO = now.toISOString();
    let processed = 0;

    for (const assignment of inactiveAssignments) {
      // Update assignment
      await supabase
        .from("officer_live_assignments")
        .update({
          status: "auto_clocked_out",
          left_at: nowISO,
          auto_clocked_out: true
        })
        .eq("id", assignment.id);

      // Find and close work session
      const { data: session } = await supabase
        .from("officer_work_sessions")
        .select("id, clock_in, officer_id")
        .is("clock_out", null)
        .eq("officer_id", assignment.officer_id)
        .eq("stream_id", assignment.stream_id)
        .order("clock_in", { ascending: false })
        .limit(1)
        .single();

      if (session) {
        // Get officer level
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("officer_level")
          .eq("id", assignment.officer_id)
          .single();

        const officerLevel = profile?.officer_level || 1;
        const hourlyRate = OFFICER_HOURLY_COINS[officerLevel] || OFFICER_HOURLY_COINS[1];

        // Calculate hours and coins
        const clockIn = new Date(session.clock_in);
        const hoursWorked = Math.max(0.1, (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60));
        const coinsEarned = Math.round(hoursWorked * hourlyRate);

        // Update session
        await supabase
          .from("officer_work_sessions")
          .update({
            clock_out: nowISO,
            hours_worked: hoursWorked,
            coins_earned: coinsEarned,
            auto_clocked_out: true
          })
          .eq("id", session.id);

        // Add coins to balance
        const { data: currentProfile } = await supabase
          .from("user_profiles")
          .select("free_coin_balance")
          .eq("id", assignment.officer_id)
          .single();

        const currentBalance = currentProfile?.free_coin_balance || 0;
        await supabase
          .from("user_profiles")
          .update({
            free_coin_balance: currentBalance + coinsEarned
          })
          .eq("id", assignment.officer_id);
      }

      processed++;
    }

    return new Response(JSON.stringify({ 
      message: "Auto-clockout completed", 
      processed 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in officer-auto-clockout:", e);
    return new Response("Server error", { status: 500 });
  }
});

