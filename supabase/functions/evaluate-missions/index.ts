import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { stream_id } = await req.json();
    if (!stream_id) {
      return new Response(
        JSON.stringify({ error: "stream_id required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Fetch active missions for the stream
    const { data: missions, error } = await supabase
      .from("stream_missions")
      .select("*")
      .eq("stream_id", stream_id)
      .eq("status", "active");

    if (error) throw error;

    const completed: string[] = [];
    const activated: string[] = [];
    const xp_awards: { mission_id: string; xp: number }[] = [];

    for (const mission of missions || []) {
      if (mission.current_value >= mission.target_value) {
        // Mark mission as completed
        const { error: updateError } = await supabase
          .from("stream_missions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", mission.id);

        if (updateError) {
          console.error(`[evaluate-missions] Failed to complete mission ${mission.id}:`, updateError);
          continue;
        }

        completed.push(mission.id);

        // Award XP to the stream owner
        if (mission.reward_xp > 0 && mission.user_id) {
          const { error: xpError } = await supabase.rpc("award_xp", {
            p_user_id: mission.user_id,
            p_xp_amount: mission.reward_xp,
            p_reason: `Mission completed: ${mission.title || mission.id}`,
          });

          if (xpError) {
            console.error(`[evaluate-missions] Failed to award XP for mission ${mission.id}:`, xpError);
          } else {
            xp_awards.push({ mission_id: mission.id, xp: mission.reward_xp });
          }
        }

        // Award badge if mission has one
        if (mission.reward_badge_id && mission.user_id) {
          const { error: badgeError } = await supabase
            .from("user_badges")
            .upsert({
              user_id: mission.user_id,
              badge_id: mission.reward_badge_id,
              awarded_at: new Date().toISOString(),
              source: "mission",
              source_id: mission.id,
            });

          if (badgeError) {
            console.error(`[evaluate-missions] Failed to award badge for mission ${mission.id}:`, badgeError);
          }
        }

        // Activate next chain mission if applicable
        if (mission.is_chain && mission.chain_order != null && mission.chain_order >= 0) {
          const { data: nextMission, error: nextError } = await supabase
            .from("stream_missions")
            .select("id")
            .eq("stream_id", stream_id)
            .eq("chain_group", mission.chain_group)
            .eq("chain_order", mission.chain_order + 1)
            .eq("status", "pending")
            .maybeSingle();

          if (nextError) {
            console.error(`[evaluate-missions] Failed to fetch next chain mission:`, nextError);
          }

          if (nextMission) {
            const { error: activateError } = await supabase
              .from("stream_missions")
              .update({
                status: "active",
                started_at: new Date().toISOString(),
              })
              .eq("id", nextMission.id);

            if (activateError) {
              console.error(`[evaluate-missions] Failed to activate next mission ${nextMission.id}:`, activateError);
            } else {
              activated.push(nextMission.id);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        completed,
        activated,
        xp_awards,
        total_evaluated: missions?.length || 0,
      }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[evaluate-missions] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});
