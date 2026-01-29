import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser?.user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const officerId = authUser.user.id;

    // Verify user is authorized (Officer, Admin, or Secretary)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_troll_officer, is_lead_officer, is_admin")
      .eq("id", officerId)
      .single();

    const role = profile?.role || "";
    const isLeadOfficer = profile?.is_lead_officer === true;
    const isOfficer = isLeadOfficer || profile?.is_troll_officer === true || role === "troll_officer";
    const isAdmin = role === "admin" || profile?.is_admin === true;
    const isSecretary = role === "secretary";

    if (!profile || (!isOfficer && !isAdmin && !isSecretary)) {
      return new Response("Only officers, admins, or secretaries can use ghost mode", { status: 403, headers: corsHeaders });
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
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (e: any) {
    console.error("Error in toggle-ghost-mode:", e);
    return new Response(JSON.stringify({ 
      error: e?.message || "Server error",
      details: "Failed to toggle ghost mode"
    }), { 
      status: 500, 
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      } 
    });
  }
});

