import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // This should be called by Supabase cron
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("X-Cron-Secret");
  
  if (cronSecret && providedSecret !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get inactive ghost officers
    const { data: inactive, error: fetchError } = await supabase.rpc("detect_ghost_inactivity");

    if (fetchError) {
      console.error("Error detecting inactivity:", fetchError);
      return new Response("Error detecting inactivity", { status: 500 });
    }

    if (!inactive || inactive.length === 0) {
      return new Response(JSON.stringify({ message: "No inactive ghost officers", processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    let processed = 0;

    for (const officer of inactive) {
      // Reduce reputation score
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("officer_reputation_score")
        .eq("id", officer.officer_id)
        .single();

      const currentScore = profile?.officer_reputation_score || 100;
      const newScore = Math.max(0, currentScore - 2);

      await supabase
        .from("user_profiles")
        .update({ officer_reputation_score: newScore })
        .eq("id", officer.officer_id);

      // Update work session with inactivity (note: ghost_inactivity_minutes column may need to be added)
      // For now, we'll just log it in a note or skip if column doesn't exist

      processed++;
    }

    return new Response(JSON.stringify({
      message: "Ghost inactivity processed",
      processed
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in ai-detect-ghost-inactivity:", e);
    return new Response("Server error", { status: 500 });
  }
});

