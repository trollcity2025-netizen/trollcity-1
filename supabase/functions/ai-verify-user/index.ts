import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY"); // Optional

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Face comparison using OpenAI Vision API or fallback
async function compareFaces(idPhotoUrl: string, selfieUrl: string): Promise<number> {
  if (!OPENAI_API_KEY) {
    // Fallback: Simple heuristic (in production, use real face comparison API)
    console.warn("No OpenAI API key, using fallback scoring");
    return 85; // Default high score for testing
  }

  try {
    // Use OpenAI Vision API to compare faces
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Compare these two images and return a similarity score from 0-100. Return ONLY the number."
              },
              {
                type: "image_url",
                image_url: { url: idPhotoUrl }
              },
              {
                type: "image_url",
                image_url: { url: selfieUrl }
              }
            ]
          }
        ],
        max_tokens: 10
      })
    });

    if (!response.ok) {
      console.error("OpenAI API error:", await response.text());
      return 75; // Fallback score
    }

    const data = await response.json();
    const scoreText = data.choices[0]?.message?.content || "75";
    return Math.min(100, Math.max(0, parseInt(scoreText) || 75));
  } catch (e) {
    console.error("Face comparison error:", e);
    return 75; // Fallback
  }
}

// Calculate behavior score based on user history
async function calculateBehaviorScore(userId: string): Promise<number> {
  try {
    // Get user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_banned, is_kicked, kick_count, officer_reputation_score")
      .eq("id", userId)
      .single();

    let score = 100;

    // Deduct points for violations
    if (profile?.is_banned) score -= 50;
    if (profile?.is_kicked) score -= 20;
    if (profile?.kick_count) score -= profile.kick_count * 5;
    
    // Add points for good reputation (if officer)
    if (profile?.officer_reputation_score) {
      score += Math.floor((profile.officer_reputation_score - 100) / 10);
    }

    // Check reports against user
    const { count: reportCount } = await supabase
      .from("abuse_reports")
      .select("*", { count: "exact", head: true })
      .eq("offender_user_id", userId);

    if (reportCount) {
      score -= reportCount * 10;
    }

    return Math.min(100, Math.max(0, score));
  } catch (e) {
    console.error("Error calculating behavior score:", e);
    return 50; // Default neutral score
  }
}

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

    const userId = authUser.user.id;
    const { idPhotoUrl, selfieUrl } = await req.json();

    if (!idPhotoUrl || !selfieUrl) {
      return new Response("Missing photo URLs", { status: 400 });
    }

    // Compare faces
    const aiMatchScore = await compareFaces(idPhotoUrl, selfieUrl);

    // Calculate behavior score
    const aiBehaviorScore = await calculateBehaviorScore(userId);

    // Determine status
    let status: string;
    if (aiMatchScore >= 75 && aiBehaviorScore >= 75) {
      status = "approved";
      // Auto-verify user
      await supabase
        .from("user_profiles")
        .update({ is_verified: true, verification_date: new Date().toISOString() })
        .eq("id", userId);
    } else if (aiMatchScore >= 50 && aiBehaviorScore >= 50) {
      status = "in_review";
    } else {
      status = "denied";
    }

    // Create verification request
    const { data: request, error: insertError } = await supabase
      .from("verification_requests")
      .insert({
        user_id: userId,
        id_photo_url: idPhotoUrl,
        selfie_url: selfieUrl,
        ai_match_score: aiMatchScore,
        ai_behavior_score: aiBehaviorScore,
        status: status
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating verification request:", insertError);
      return new Response("Failed to create request", { status: 500 });
    }

    return new Response(JSON.stringify({
      success: true,
      requestId: request.id,
      aiMatchScore,
      aiBehaviorScore,
      status,
      autoApproved: status === "approved"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in ai-verify-user:", e);
    return new Response("Server error", { status: 500 });
  }
});

