import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
const GEMINI_BASE_URL = Deno.env.get("GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RequestBody {
  action: "summary" | "questions" | "recommendation";
  courtId: string;
  transcript: any[];
}

function redactPII(text: string): string {
  // Redact emails
  let redacted = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]");
  // Redact phone numbers (simple pattern)
  redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE_REDACTED]");
  return redacted;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role (Judge/Admin/Officer)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_admin, is_lead_officer")
      .eq("id", user.id)
      .single();

    const isAuthorized =
      profile?.role === "admin" ||
      profile?.role === "lead_troll_officer" ||
      profile?.role === "troll_officer" ||
      profile?.is_admin ||
      profile?.is_lead_officer;

    // We allow unauthorized users to potentially GET last saved output (if we implemented GET),
    // but the requirement says "permission gate: only Judge/Admin/TrollOfficer can click 'Generate'".
    // Since this endpoint triggers generation, we strictly enforce authorization.
    if (!isAuthorized) {
       return new Response(JSON.stringify({ error: "Forbidden: Authorized personnel only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const { action, courtId, transcript } = body;

    if (!courtId || !transcript) {
      throw new Error("Missing courtId or transcript");
    }

    // Rate Limiting: Check last generation for this court session
    // Limit to 1 request per 60 seconds per case to prevent spam/abuse
    const { data: lastFeedback } = await supabase
        .from("court_ai_feedback")
        .select("created_at")
        .eq("case_id", courtId)
        .eq("agent_role", "TrollCourt AI")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (lastFeedback) {
        const lastTime = new Date(lastFeedback.created_at).getTime();
        const now = new Date().getTime();
        const timeDiff = now - lastTime; // in ms
        const COOLDOWN_MS = 60 * 1000; // 60 seconds

        if (timeDiff < COOLDOWN_MS) {
             const waitSeconds = Math.ceil((COOLDOWN_MS - timeDiff) / 1000);
             return new Response(JSON.stringify({ error: `Rate limit: Please wait ${waitSeconds}s before regenerating.` }), {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
             });
        }
    }

    // Redact PII from transcript
    const redactedTranscript = transcript.map((t: any) => ({
      ...t,
      message: t.message ? redactPII(t.message) : "",
      user: t.user ? redactPII(t.user) : "Unknown"
    }));

    // Build Prompt
    const systemPrompt = `You are TrollCourt AI Assist. Not final authority. Output STRICT JSON only.
    Analyze the provided court transcript and provide:
    - summary: A brief summary of the case so far.
    - key_events: List of key events.
    - questions: Suggested clarifying questions for the judge.
    - recommendation: A verdict recommendation with reasoning (guilty/not guilty).
    - confidence: 0.0 to 1.0.

    Focus on the requested action: ${action}.
    Transcript provided below.`;

    const geminiUrl = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiPayload = {
      contents: [{
        parts: [{ text: systemPrompt + "\n\n" + JSON.stringify(redactedTranscript) }]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error("No content generated from Gemini");
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(generatedText);
    } catch {
      // Fallback if not pure JSON (though responseMimeType should handle it)
      parsedResult = { raw: generatedText };
    }

    // Save to court_ai_feedback for persistence and "view only" access
    try {
      const feedbackText = parsedResult.summary || parsedResult.recommendation || "AI Analysis Generated";
      await supabase.from("court_ai_feedback").insert({
        case_id: courtId,
        agent_role: "TrollCourt AI",
        feedback_text: feedbackText,
        json_data: parsedResult,
      });
    } catch (dbError) {
      console.error("Failed to save AI feedback to DB:", dbError);
    }

    // Return result
    return new Response(JSON.stringify({ success: true, data: parsedResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
