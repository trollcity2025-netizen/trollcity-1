import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface NotificationRequest {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  targetUserIds?: string[];
}

interface UserProfile {
  id: string;
}

serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
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

    const body = await req.json() as NotificationRequest;
    const { type, title, message, metadata = {}, targetUserIds } = body;

    if (!type || !title || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields: type, title, message" }), { status: 400, headers });
    }


    // Get user IDs - either specific users or all users
    let userIds: string[];
    
    if (targetUserIds && targetUserIds.length > 0) {
      userIds = targetUserIds;
    } else {
      // Get all user IDs
      const { data: users, error: usersErr } = await supabase
        .from("user_profiles")
        .select("id");

      if (usersErr) {
        console.error("Error fetching users:", usersErr);
        return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500, headers });
      }

      userIds = users?.map((u: UserProfile) => u.id) ?? [];
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No users to notify",
        notificationCount: 0 
      }), { status: 200, headers });
    }

    // Create notification records
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type,
      title,
      message,
      metadata,
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

    console.log(`Bulk notifications: ${insertedCount} inserted, ${errorCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: `Notifications sent to ${insertedCount} users`,
      notificationCount: insertedCount,
      failedCount: errorCount
    }), { status: 200, headers });

  } catch (e) {
    console.error("Server error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal server error", details: errorMessage }), { status: 500, headers });
  }
});
