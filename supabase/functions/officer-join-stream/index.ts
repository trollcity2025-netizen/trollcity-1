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
      console.error("Auth error:", authError);
      return new Response("Unauthorized", { status: 401 });
    }

    const officerId = authUser.user.id;
    const { streamId } = await req.json();

    if (!streamId) {
      return new Response("Missing streamId", { status: 400 });
    }

    // Verify user is an officer
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, is_troll_officer, is_officer_active")
      .eq("id", officerId)
      .single();

    if (profileError || (!profile?.is_troll_officer && profile?.role !== "troll_officer" && profile?.role !== "admin")) {
      return new Response("User is not an officer", { status: 403 });
    }

    // Mark any older entries as inactive and close their work sessions
    const { data: oldAssignments } = await supabase
      .from("officer_live_assignments")
      .select("id")
      .match({ officer_id: officerId, status: "active" });

    if (oldAssignments && oldAssignments.length > 0) {
      await supabase
        .from("officer_live_assignments")
        .update({ status: "left", left_at: new Date().toISOString() })
        .match({ officer_id: officerId, status: "active" });

      // Close any open work sessions
      await supabase
        .from("officer_work_sessions")
        .update({ clock_out: new Date().toISOString() })
        .is("clock_out", null)
        .eq("officer_id", officerId);
    }

    // Create a new active assignment
    const now = new Date().toISOString();
    const { error: insertError } = await supabase
      .from("officer_live_assignments")
      .insert({
        officer_id: officerId,
        stream_id: streamId,
        status: "active",
        joined_at: now,
        last_activity: now
      });

    // Start a new work session
    if (!insertError) {
      await supabase
        .from("officer_work_sessions")
        .insert({
          officer_id: officerId,
          stream_id: streamId,
          clock_in: now
        });
    }

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response("Failed to create assignment", { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in officer-join-stream:", e);
    return new Response("Server error", { status: 500 });
  }
});

