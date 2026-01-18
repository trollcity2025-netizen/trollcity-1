import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date();
    const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { error: closeError } = await supabaseAdmin
      .from("officer_vote_cycles")
      .update({ status: "closed", ends_at: now.toISOString() })
      .eq("status", "active");

    if (closeError) {
      console.error("Failed to close existing officer cycles", closeError);
    }

    const { data: cycle, error: cycleError } = await supabaseAdmin
      .from("officer_vote_cycles")
      .insert({
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "active",
      })
      .select("id, starts_at, ends_at")
      .single();

    if (cycleError || !cycle) {
      return new Response(JSON.stringify({ error: "Failed to start officer vote cycle" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: adminUser } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (adminUser && adminUser.id) {
      const { error: eventError } = await supabaseAdmin.from("vote_events").insert({
        event_type: "officer_cycle_started",
        user_id: adminUser.id,
        gift_id: null,
        is_active: true,
      });

      if (eventError) {
        console.error("Failed to create officer_cycle_started event", eventError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cycleId: cycle.id,
        startsAt: cycle.starts_at,
        endsAt: cycle.ends_at,
      }),
      {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("start_officer_vote_cycle error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
