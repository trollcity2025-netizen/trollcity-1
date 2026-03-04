/**
 * Process Audio Safety - Edge Function
 * 
 * This edge function processes audio chunks for safety keyword detection.
 * It uses the database function create_safety_alert to handle the actual
 * alert creation and escalation logic.
 * 
 * PRIVACY: This function NEVER stores full transcripts. Only trigger phrases
 * are stored when safety keywords are detected.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Safety keyword categories for detection
const SAFETY_KEYWORDS = {
  SELF_HARM: [
    'kill myself', 'suicide', 'end my life', 'i want to die', 'hurt myself',
    'cut myself', 'overdose', 'self harm', 'not worth living', 'better off dead',
    'can\'t go on', 'end it all', 'no reason to live', 'want to disappear',
    'wish i was dead', 'thinking about suicide', 'planning suicide'
  ],
  THREAT: [
    'kill you', 'shoot you', 'stab you', 'hurt you', 'i will find you',
    'beat you up', 'coming for you', 'watch your back', 'you\'re dead',
    'i\'m gonna hurt', 'going to hurt', 'make you pay', 'destroy you',
    'ruin your life', 'get revenge', 'payback'
  ],
  VIOLENCE: [
    'gonna kill', 'going to kill', 'murder', 'attack', 'bomb', 'weapon',
    'gun', 'knife', 'shoot up', 'massacre', 'terrorist', 'violent',
    'physical harm', 'blood', 'die', 'death threat'
  ],
  ABUSE: [
    'kys', 'kill yourself', 'go die', 'hope you die', 'die in a fire',
    'should die', 'worthless', 'pathetic', 'disgusting', 'garbage',
    'trash', 'scum', 'subhuman', 'kill urself', 'neck yourself'
  ]
};

interface DetectedKeyword {
  keyword: string;
  category: keyof typeof SAFETY_KEYWORDS;
  severity: number;
}

/**
 * Detect safety keywords in transcript
 */
function detectSafetyKeywords(transcript: string): DetectedKeyword[] {
  const detected: DetectedKeyword[] = [];
  const lowerTranscript = transcript.toLowerCase();
  
  for (const [category, keywords] of Object.entries(SAFETY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerTranscript.includes(keyword.toLowerCase())) {
        // Determine severity based on category
        let severity = 1;
        switch (category) {
          case 'SELF_HARM':
            severity = 3;
            break;
          case 'THREAT':
            severity = 3;
            break;
          case 'VIOLENCE':
            severity = 2;
            break;
          case 'ABUSE':
            severity = 1;
            break;
        }
        
        detected.push({
          keyword,
          category: category as keyof typeof SAFETY_KEYWORDS,
          severity
        });
      }
    }
  }
  
  // Return highest severity match for each category
  const byCategory = new Map<string, DetectedKeyword>();
  for (const d of detected) {
    const existing = byCategory.get(d.category);
    if (!existing || d.severity > existing.severity) {
      byCategory.set(d.category, d);
    }
  }
  
  return Array.from(byCategory.values());
}

/**
 * Sanitize transcript - only keep trigger phrases and surrounding context
 */
function sanitizeTranscript(transcript: string, keywords: DetectedKeyword[]): string {
  if (keywords.length === 0) return '';
  
  // Extract sentences containing keywords
  const sentences = transcript.split(/[.!?]+/);
  const relevantSentences: string[] = [];
  
  for (const sentence of sentences) {
    for (const kw of keywords) {
      if (sentence.toLowerCase().includes(kw.keyword.toLowerCase())) {
        relevantSentences.push(sentence.trim());
        break;
      }
    }
  }
  
  return relevantSentences.join('. ');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Parse request body
    const { 
      stream_id, 
      user_id, 
      transcript, 
      user_role,
      chunk_id 
    } = await req.json();

    if (!stream_id || !user_id || !transcript) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: stream_id, user_id, transcript" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Only monitor broadcaster and guest roles
    const monitoredRoles = ['broadcaster', 'guest', 'host', 'co_host'];
    if (user_role && !monitoredRoles.includes(user_role.toLowerCase())) {
      return new Response(
        JSON.stringify({ 
          processed: true, 
          monitored: false, 
          reason: "User role not eligible for monitoring"
        }),
        { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Detect safety keywords
    const detectedKeywords = detectSafetyKeywords(transcript);
    
    if (detectedKeywords.length === 0) {
      return new Response(
        JSON.stringify({ 
          processed: true, 
          monitored: true,
          alert_triggered: false 
        }),
        { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Get highest severity keyword
    const highestSeverity = detectedKeywords.reduce((max, k) => 
      k.severity > max.severity ? k : max
    );

    // Sanitize transcript
    const sanitizedTranscript = sanitizeTranscript(transcript, detectedKeywords);

    // Call database function to create safety alert
    const { data: alertData, error: alertError } = await supabaseAdmin
      .rpc('create_safety_alert', {
        p_stream_id: stream_id,
        p_user_id: user_id,
        p_trigger_type: highestSeverity.category,
        p_trigger_phrase: highestSeverity.keyword
      });

    if (alertError) {
      console.error("[process-audio-safety] Failed to create alert:", alertError);
      throw alertError;
    }

    // Store temporary transcript (only if alert created)
    // This will be auto-deleted after 5 minutes via the service
    if (chunk_id && sanitizedTranscript) {
      await supabaseAdmin
        .from('stream_audio_monitoring')
        .upsert({
          stream_id,
          user_id,
          last_transcript_snippet: sanitizedTranscript.substring(0, 200), // Limit length
          last_alert_at: new Date().toISOString()
        });
    }

    return new Response(
      JSON.stringify({
        processed: true,
        monitored: true,
        alert_triggered: true,
        alert_id: alertData?.alert_id,
        alert_level: alertData?.alert_level,
        total_triggers: alertData?.total_triggers,
        trigger_type: highestSeverity.category,
        trigger_phrase: highestSeverity.keyword
      }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[process-audio-safety] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});
