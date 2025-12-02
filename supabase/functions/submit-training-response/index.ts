import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const { scenarioId, actionTaken, responseTime } = await req.json();

    if (!scenarioId || !actionTaken) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Get scenario
    const { data: scenario, error: scenarioError } = await supabase
      .from("training_scenarios")
      .select("*")
      .eq("id", scenarioId)
      .single();

    if (scenarioError || !scenario) {
      return new Response("Scenario not found", { status: 404 });
    }

    const isCorrect = scenario.correct_action === actionTaken;
    const pointsEarned = isCorrect ? scenario.points_awarded : 0;

    // Insert training session record
    const { error: insertError } = await supabase
      .from("officer_training_sessions")
      .insert({
        officer_id: officerId,
        scenario_id: scenarioId,
        action_taken: actionTaken,
        is_correct: isCorrect,
        response_time_seconds: responseTime,
        points_earned: pointsEarned
      });

    if (insertError) {
      console.error("Error inserting training session:", insertError);
      return new Response("Failed to save response", { status: 500 });
    }

    // Check if officer qualifies for promotion (≥80% accuracy and 150+ points)
    const { data: sessions } = await supabase
      .from("officer_training_sessions")
      .select("is_correct, points_earned")
      .eq("officer_id", officerId);

    if (sessions && sessions.length > 0) {
      const totalPoints = sessions.reduce((sum, s) => sum + (s.points_earned || 0), 0);
      const correctCount = sessions.filter(s => s.is_correct).length;
      const accuracy = (correctCount / sessions.length) * 100;

      if (accuracy >= 80 && totalPoints >= 150) {
        // Promote to officer
        await supabase
          .from("user_profiles")
          .update({
            role: 'troll_officer',
            is_troll_officer: true,
            officer_level: 1
          })
          .eq("id", officerId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      isCorrect,
      pointsEarned,
      correctAction: scenario.correct_action
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in submit-training-response:", e);
    return new Response("Server error", { status: 500 });
  }
});

