// deno-lint-ignore-file
// @ts-expect-error Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const _SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://maitrollcity.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin"
};

interface DismissRequest {
  notification_id?: string;
  notification_ids?: string[];
  dismiss_all?: boolean;
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
    const supabaseKey = _SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify user
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const userId = userData.user.id;
    const body = await req.json() as DismissRequest;
    const { notification_id, notification_ids, dismiss_all } = body;

    if (dismiss_all) {
      // Dismiss all user's notifications
      const { error: updateErr } = await supabase
        .from("notifications")
        .update({ 
          is_dismissed: true, 
          dismissed_at: new Date().toISOString() 
        })
        .eq("user_id", userId)
        .eq("is_dismissed", false);

      if (updateErr) {
        console.error("Error dismissing all notifications:", updateErr);
        return new Response(JSON.stringify({ error: "Failed to dismiss notifications" }), { status: 500, headers });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "All notifications dismissed" 
      }), { status: 200, headers });
    }

    if (notification_ids && notification_ids.length > 0) {
      // Dismiss specific notifications
      const { error: updateErr } = await supabase
        .from("notifications")
        .update({ 
          is_dismissed: true, 
          dismissed_at: new Date().toISOString() 
        })
        .eq("user_id", userId)
        .in("id", notification_ids);

      if (updateErr) {
        console.error("Error dismissing notifications:", updateErr);
        return new Response(JSON.stringify({ error: "Failed to dismiss notifications" }), { status: 500, headers });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `${notification_ids.length} notifications dismissed`,
        count: notification_ids.length
      }), { status: 200, headers });
    }

    if (notification_id) {
      // Dismiss single notification
      const { error: updateErr } = await supabase
        .from("notifications")
        .update({ 
          is_dismissed: true, 
          dismissed_at: new Date().toISOString() 
        })
        .eq("id", notification_id)
        .eq("user_id", userId);

      if (updateErr) {
        console.error("Error dismissing notification:", updateErr);
        return new Response(JSON.stringify({ error: "Failed to dismiss notification" }), { status: 500, headers });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Notification dismissed" 
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Missing notification_id, notification_ids, or dismiss_all" }), { status: 400, headers });

  } catch (e) {
    console.error("Server error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal server error", details: errorMessage }), { status: 500, headers });
  }
});
