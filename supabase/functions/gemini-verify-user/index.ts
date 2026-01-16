import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://trollcity.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": FRONTEND_URL,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  idPhotoUrl: string;
  selfieUrl: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Invalid or expired token");
    }

    // Check if user is admin - admins bypass Gemini verification
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin" || profile?.is_admin === true;

    const body: VerificationRequest = await req.json();
    const { idPhotoUrl, selfieUrl } = body;

    if (!idPhotoUrl || !selfieUrl) {
      throw new Error("Missing required photo URLs");
    }

    let aiMatchScore = 0;
    let aiBehaviorScore = 0;
    let autoApproved = false;
    let status = "pending";

    // Admin verification - auto-approve
    if (isAdmin) {
      aiMatchScore = 100;
      aiBehaviorScore = 100;
      autoApproved = true;
      status = "approved";
    } else if (GEMINI_API_KEY) {
      // Non-admin: Use Gemini for verification
      try {
        // Convert image URLs to base64
        const [idImageResponse, selfieImageResponse] = await Promise.all([
          fetch(idPhotoUrl),
          fetch(selfieUrl),
        ]);

        const [idImageBlob, selfieImageBlob] = await Promise.all([
          idImageResponse.blob(),
          selfieImageResponse.blob(),
        ]);

        const [idImageBase64, selfieImageBase64] = await Promise.all([
          blobToBase64(idImageBlob),
          blobToBase64(selfieImageBlob),
        ]);

        // Call Gemini Vision API
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are an ID verification system. Compare the person in the ID document with the person in the selfie photo. 

Analyze:
1. Face matching: Do the faces match? (0-100 score)
2. ID authenticity: Does the ID look genuine? (0-100 score)
3. Liveness: Does the selfie appear to be a live photo? (0-100 score)

Respond ONLY with valid JSON in this exact format:
{
  "matchScore": 85,
  "authenticityScore": 90,
  "livenessScore": 88,
  "reasoning": "Brief explanation of scores"
}`,
                    },
                    {
                      inline_data: {
                        mime_type: "image/jpeg",
                        data: idImageBase64,
                      },
                    },
                    {
                      inline_data: {
                        mime_type: "image/jpeg",
                        data: selfieImageBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
              },
            }),
          }
        );

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error("Gemini API error:", errorText);
          throw new Error(`Gemini API error: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
          throw new Error("No response from Gemini");
        }

        // Parse Gemini response
        const cleanedResponse = responseText.replace(/```json\n?|```\n?/g, "").trim();
        const analysis = JSON.parse(cleanedResponse);

        // Calculate scores
        aiMatchScore = analysis.matchScore || 0;
        const authenticityScore = analysis.authenticityScore || 0;
        const livenessScore = analysis.livenessScore || 0;

        // Behavior score is average of authenticity and liveness
        aiBehaviorScore = Math.round((authenticityScore + livenessScore) / 2);

        // Auto-approval logic
        if (aiMatchScore >= 75 && aiBehaviorScore >= 75) {
          status = "approved";
          autoApproved = true;
        } else if (aiMatchScore >= 50 && aiBehaviorScore >= 50) {
          status = "in_review";
          autoApproved = false;
        } else {
          status = "denied";
          autoApproved = false;
        }

        console.log(
          `[Gemini] Verification scores - Match: ${aiMatchScore}, Behavior: ${aiBehaviorScore}, Status: ${status}`
        );
      } catch (geminiError) {
        console.error("Gemini verification error:", geminiError);
        // Fall back to manual review
        status = "in_review";
        aiMatchScore = 0;
        aiBehaviorScore = 0;
      }
    } else {
      // No Gemini API key - manual review required
      console.warn("No GEMINI_API_KEY configured, defaulting to manual review");
      status = "in_review";
    }

    // Create verification request record
    const { data: verificationRequest, error: insertError } = await supabase
      .from("verification_requests")
      .insert({
        user_id: user.id,
        status: status,
        id_photo_url: idPhotoUrl,
        selfie_url: selfieUrl,
        ai_match_score: aiMatchScore / 100, // Store as 0-1
        ai_behavior_score: aiBehaviorScore / 100, // Store as 0-1
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting verification request:", insertError);
      throw insertError;
    }

    // If auto-approved, update user profile
    if (autoApproved) {
      await supabase
        .from("user_profiles")
        .update({
          is_verified: true,
          id_verification_status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      // Send notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "verification_approved",
        title: "ID Verification Approved",
        message: "Your ID has been verified! You now have full access to all features.",
        read: false,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: status,
        autoApproved: autoApproved,
        aiMatchScore: aiMatchScore,
        aiBehaviorScore: aiBehaviorScore,
        verificationId: verificationRequest.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Verification failed",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

// Helper function to convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}
