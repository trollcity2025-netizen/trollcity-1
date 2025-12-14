import { serve } from "https://deno.land/std@0.214.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find expired cycles that haven't been processed
    const { data: expiredCycles, error } = await supabase
      .from("home_feature_cycles")
      .select("id")
      .lt("end_time", new Date().toISOString())
      .eq("winner_user_id", null);

    if (error) throw error;

    for (const cycle of expiredCycles) {
      // Call the end function
      await supabase.rpc("end_home_feature_cycle", { p_cycle_id: cycle.id });
    }

    return new Response(JSON.stringify({
      processed: expiredCycles.length
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
});