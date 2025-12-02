import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OBSERVER_AI_URL = Deno.env.get("OBSERVER_AI_URL"); // Optional AI endpoint

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    const { streamId, targetUserId, actionType, reason, context } = await req.json();

    if (!actionType || !reason) {
      return new Response("Missing required fields", { status: 400 });
    }

    // 1) Log moderation event
    const { data: event, error: eventErr } = await supabase
      .from("moderation_events")
      .insert({
        officer_id: officerId,
        stream_id: streamId || null,
        target_user_id: targetUserId || null,
        action_type: actionType,
        reason,
        context: context || {}
      })
      .select("*")
      .single();

    if (eventErr || !event) {
      console.error("Error logging event:", eventErr);
      return new Response("Failed to log event", { status: 500 });
    }

    // 2) Ask AI grader (Observer Bot) - if configured
    let rating = null;
    if (OBSERVER_AI_URL) {
      try {
        const aiRes = await fetch(OBSERVER_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            officerId,
            streamId,
            actionType,
            reason,
            context,
            policyVersion: "troll-city-v1"
          })
        });

        if (aiRes.ok) {
          rating = await aiRes.json();
        }
      } catch (e) {
        console.error("AI observer error:", e);
        // Continue without AI rating
      }
    }

    // If no AI, use simple rule-based scoring
    if (!rating) {
      // Simple scoring: ban=80, mute=70, warn=60, kick=65
      const baseScores: Record<string, number> = {
        ban: 80,
        mute: 70,
        warn: 60,
        kick: 65,
        shadow_ban: 75
      };
      rating = {
        score: baseScores[actionType] || 50,
        verdict: "correct",
        policyTags: [reason.toLowerCase()],
        feedback: `Action ${actionType} taken for ${reason}`,
        modelVersion: "rule-based-v1"
      };
    }

    const { score, verdict, policyTags, feedback, modelVersion } = rating;

    // 3) Insert observer rating
    await supabase
      .from("observer_ratings")
      .insert({
        event_id: event.id,
        score: score || 50,
        verdict: verdict || "correct",
        policy_tags: policyTags || [],
        feedback: feedback || "",
        model_version: modelVersion || "unknown"
      });

    // 4) Adjust officer reputation
    const delta =
      score >= 90 ? 3 :
      score >= 80 ? 2 :
      score >= 60 ? 0 :
      score >= 40 ? -2 : -5;

    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("officer_reputation_score")
      .eq("id", officerId)
      .single();

    const baseScore = profileData?.officer_reputation_score ?? 100;
    const newScore = Math.max(0, Math.min(200, baseScore + delta));

    await supabase
      .from("user_profiles")
      .update({ officer_reputation_score: newScore })
      .eq("id", officerId);

    return new Response(JSON.stringify({
      success: true,
      graded: !!rating,
      score: rating?.score,
      verdict: rating?.verdict,
      reputationChange: delta
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in log-moderation-event:", e);
    return new Response("Server error", { status: 500 });
  }
});

