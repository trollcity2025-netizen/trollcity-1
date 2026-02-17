import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight();
  }

  const origin = req.headers.get("origin");

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, role, is_admin, troll_role, is_troll_officer, is_lead_officer")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    const isStaff = !!(
      profile.is_admin ||
      profile.role === "admin" ||
      profile.troll_role === "admin" ||
      profile.role === "troll_officer" ||
      profile.is_troll_officer ||
      profile.role === "lead_troll_officer" ||
      profile.is_lead_officer ||
      profile.role === "secretary"
    );

    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
      });
    }

    const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
    const { data: rawPresence, error: presenceError } = await supabaseAdmin
      .from("user_presence")
      .select("user_id") // Only select user_id initially
      .gt("last_seen_at", twoMinutesAgo);

    if (presenceError) {
      throw presenceError;
    }

    const onlineUserIds = rawPresence?.map((p) => p.user_id) || [];

    let usersWithProfiles = [];
    if (onlineUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("user_profiles")
        .select("id, username, avatar_url")
        .in("id", onlineUserIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));

      usersWithProfiles = onlineUserIds.map((userId) => {
        const profile = profileMap.get(userId);
        return {
          user_id: userId,
          username: profile?.username || `Unknown User (${userId.substring(0, 8)}...)`,
          avatar_url: profile?.avatar_url || null,
          location_type: "online", // Default to online for simplicity here
          location_name: "Online",
        };
      });
    }

    return new Response(JSON.stringify({ users: usersWithProfiles }), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[online-users] Error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
    });
  }
});
