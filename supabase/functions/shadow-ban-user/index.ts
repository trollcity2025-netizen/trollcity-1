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

    // Verify user is an officer
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_troll_officer")
      .eq("id", officerId)
      .single();

    if (!profile || (!profile.is_troll_officer && profile.role !== "troll_officer" && profile.role !== "admin")) {
      return new Response("Only officers can shadow ban", { status: 403 });
    }

    const { streamId, targetUserId, reason, durationMinutes } = await req.json();

    if (!targetUserId || !reason) {
      return new Response("Missing required fields", { status: 400 });
    }

    const expiresAt = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60000).toISOString()
      : null;

    // Insert shadow ban
    const { error: insertError } = await supabase
      .from("shadow_bans")
      .insert({
        officer_id: officerId,
        target_user_id: targetUserId,
        stream_id: streamId || null,
        reason,
        expires_at: expiresAt,
        is_active: true
      });

    if (insertError) {
      console.error("Error creating shadow ban:", insertError);
      return new Response("Failed to create shadow ban", { status: 500 });
    }

    // Log moderation event (shadow ban doesn't deduct coins)
    await supabase
      .from("moderation_events")
      .insert({
        officer_id: officerId,
        stream_id: streamId || null,
        target_user_id: targetUserId,
        action_type: "shadow_ban",
        reason,
        context: { durationMinutes }
      });

    return new Response(JSON.stringify({
      success: true,
      message: "Shadow ban activated"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in shadow-ban-user:", e);
    return new Response("Server error", { status: 500 });
  }
});

