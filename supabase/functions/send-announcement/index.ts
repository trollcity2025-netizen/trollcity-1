// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const _SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://maitrollcity.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin"
};

interface AnnouncementRequest {
  title: string;
  body: string;
  user_ids: string[];
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
    // Verify admin authorization
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers });
    }

    const supabaseUrl = SUPABASE_URL;
    const supabaseKey = _SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify user is admin
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", userData.user.id)
      .single();

    const isAdmin = profile?.role === "admin" || profile?.is_admin === true;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers });
    }

    const body = await req.json() as AnnouncementRequest;
    const { title, body: message, user_ids: userIds } = body;

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields: title, body" }), { status: 400, headers });
    }

    if (!userIds || userIds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No users to notify",
        count: 0 
      }), { status: 200, headers });
    }

    // Create notification records
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type: "announcement",
      title,
      message,
      metadata: {},
      is_read: false,
      created_at: new Date().toISOString(),
    }));

    // Insert using RPC function (bypasses RLS)
    const BATCH_SIZE = 1000;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
      const batch = notifications.slice(i, i + BATCH_SIZE);
      
      // Use RPC function for bulk insert
      const { error: rpcErr } = await supabase.rpc("bulk_create_notifications", {
        p_notifications: JSON.stringify(batch),
      });

      if (rpcErr) {
        console.error("Error inserting notifications via RPC:", rpcErr);
        // Fallback to direct insert if RPC fails
        const { error: insertErr } = await supabase
          .from("notifications")
          .insert(batch);

        if (insertErr) {
          console.error("Error inserting notifications batch:", insertErr);
          errorCount += batch.length;
        } else {
          insertedCount += batch.length;
        }
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`Announcements: ${insertedCount} inserted, ${errorCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: `Announcement sent to ${insertedCount} users`,
      count: insertedCount,
      failedCount: errorCount
    }), { status: 200, headers });

  } catch (e) {
    console.error("Server error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal server error", details: errorMessage }), { status: 500, headers });
  }
});
