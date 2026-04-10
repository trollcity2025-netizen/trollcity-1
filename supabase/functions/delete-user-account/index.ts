import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DeleteBody {
  reason: string;
  confirmPermanent: boolean;
  confirmNoRefund: boolean;
}

async function getSupabase() {
  const mod = await import("@supabase/supabase-js");
  return mod;
}

async function authorizeUser(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing authorization header");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error("Server configuration error");
  }

  const { createClient } = await getSupabase();
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) {
    throw new Error("No active session. Please sign in again.");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  return { user, supabaseAdmin };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as DeleteBody;
    
    if (!body.confirmPermanent || !body.confirmNoRefund) {
      return new Response(JSON.stringify({ error: "You must acknowledge the warnings to delete your account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, supabaseAdmin } = await authorizeUser(req);

    // Get user profile info before deletion
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("username, email, coins, tier")
      .eq("id", user.id)
      .maybeSingle();

    const username = profile?.username || "Unknown";
    const userEmail = profile?.email || "";

    // Delete from all major tables first (explicit deletes for tables without cascade)
    const tablesToDelete = [
      "user_profiles",
      "user_coins",
      "user_follows",
      "user_blocks", 
      "user_perks",
      "user_insurances",
      "user_call_sounds",
      "user_entrance_audio",
      "user_achievements",
      "stream_seat_sessions",
      "gift_transactions",
      "payout_requests",
      "notifications",
      "applications",
      "officer_assignments",
      "troll_wheel_wins",
      "pod_participants",
      "pod_room_participants",
      "house_participants",
      "vehicle_participants",
    ];

    for (const table of tablesToDelete) {
      try {
        await supabaseAdmin.from(table).delete().eq("user_id", user.id);
      } catch (e) {
        console.log(`Error deleting from ${table}:`, e);
      }
    }

    // Delete associated streams
    await supabaseAdmin.from("streams").delete().eq("user_id", user.id);
    await supabaseAdmin.from("streams").delete().eq("broadcaster_id", user.id);

    // Delete auth user (this should cascade to other tables)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (authError) {
      console.error("Auth delete error:", authError);
    }

    // Insert admin notification
    await supabaseAdmin.from("admin_notifications").insert({
      type: "account_deleted",
      title: "User Account Deleted",
      message: `User @${username} (${userEmail}) has permanently deleted their account. Reason: ${body.reason || "Not provided"}`,
      metadata: {
        deleted_user_id: user.id,
        username,
        user_email: userEmail,
        reason: body.reason,
        deleted_at: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ ok: true, message: "Account deleted successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});