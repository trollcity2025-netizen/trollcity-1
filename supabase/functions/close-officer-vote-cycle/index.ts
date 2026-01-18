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
    const nowIso = new Date().toISOString();

    const { data: cycle, error: cycleError } = await supabaseAdmin
      .from("officer_vote_cycles")
      .select("id, starts_at, ends_at, status")
      .eq("status", "active")
      .lte("ends_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cycleError || !cycle) {
      return new Response(JSON.stringify({ error: "No active cycle to close" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: votes, error: votesError } = await supabaseAdmin
      .from("officer_votes")
      .select("broadcaster_id")
      .eq("cycle_id", cycle.id);

    if (votesError) {
      return new Response(JSON.stringify({ error: "Failed to load votes" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!votes || votes.length === 0) {
      const { error: closeError } = await supabaseAdmin
        .from("officer_vote_cycles")
        .update({ status: "closed" })
        .eq("id", cycle.id);

      if (closeError) {
        console.error("Failed to close empty officer cycle", closeError);
      }

      return new Response(JSON.stringify({ success: true, winnerAssigned: false }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const counts = new Map<string, number>();
    for (const v of votes) {
      const id = v.broadcaster_id as string;
      counts.set(id, (counts.get(id) || 0) + 1);
    }

    let winnerId: string | null = null;
    let winnerVotes = -1;
    for (const [id, count] of counts.entries()) {
      if (count > winnerVotes) {
        winnerId = id;
        winnerVotes = count;
      }
    }

    if (!winnerId) {
      const { error: closeError } = await supabaseAdmin
        .from("officer_vote_cycles")
        .update({ status: "closed" })
        .eq("id", cycle.id);

      if (closeError) {
        console.error("Failed to close officer cycle without winner", closeError);
      }

      return new Response(JSON.stringify({ success: true, winnerAssigned: false }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: assignment, error: assignError } = await supabaseAdmin
      .from("officer_assignments")
      .insert({
        cycle_id: cycle.id,
        broadcaster_id: winnerId,
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select("id, broadcaster_id, starts_at, ends_at")
      .single();

    if (assignError || !assignment) {
      return new Response(JSON.stringify({ error: "Failed to assign officer winner" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error: closeError } = await supabaseAdmin
      .from("officer_vote_cycles")
      .update({ status: "closed" })
      .eq("id", cycle.id);

    if (closeError) {
      console.error("Failed to mark officer cycle closed", closeError);
    }

    const { error: eventError } = await supabaseAdmin.from("vote_events").insert({
      event_type: "officer_cycle_winner",
      user_id: assignment.broadcaster_id,
      gift_id: null,
      is_active: true,
    });

    if (eventError) {
      console.error("Failed to create officer_cycle_winner event", eventError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        winnerAssigned: true,
        winnerId: assignment.broadcaster_id,
        assignmentId: assignment.id,
        startsAt: assignment.starts_at,
        endsAt: assignment.ends_at,
      }),
      {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("close_officer_vote_cycle error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

