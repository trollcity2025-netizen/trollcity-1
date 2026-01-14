import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://maitrollcity.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin"
};

interface PreferencesRequest {
  announcements_enabled?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS
  const origin = req.headers.get('origin');
  const allowedOrigins = [
    'https://maitrollcity.com',
    'https://www.maitrollcity.com',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  
  const headers = { ...corsHeaders };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers });
    }

    const supabaseUrl = SUPABASE_URL;
    const supabaseKey = token; // Use the user's JWT to update their own profile

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify user
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const userId = userData.user.id;
    const body = await req.json() as PreferencesRequest;
    const { announcements_enabled } = body;

    if (announcements_enabled === undefined) {
      return new Response(JSON.stringify({ error: "Missing announcements_enabled" }), { status: 400, headers });
    }

    // Update user profile with announcement preference
    const { error: updateErr } = await supabase
      .from("user_profiles")
      .update({ announcements_enabled })
      .eq("id", userId);

    if (updateErr) {
      console.error("Error updating preferences:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to update preferences" }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Preferences updated",
      announcements_enabled 
    }), { status: 200, headers });

  } catch (e) {
    console.error("Server error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal server error", details: errorMessage }), { status: 500, headers });
  }
});
