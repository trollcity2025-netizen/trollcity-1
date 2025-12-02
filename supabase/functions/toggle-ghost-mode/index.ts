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
      return new Response("Only officers can use ghost mode", { status: 403 });
    }

    const { enabled } = await req.json();

    // Update user profile
    await supabase
      .from("user_profiles")
      .update({ is_ghost_mode: enabled === true })
      .eq("id", officerId);

    // Update active assignments
    await supabase
      .from("officer_live_assignments")
      .update({ ghost_mode_active: enabled === true })
      .eq("officer_id", officerId)
      .eq("status", "active");

    return new Response(JSON.stringify({
      success: true,
      ghostMode: enabled === true
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in toggle-ghost-mode:", e);
    return new Response("Server error", { status: 500 });
  }
});

