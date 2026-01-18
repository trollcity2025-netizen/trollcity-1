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
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, token, {
      global: { headers: { Authorization: authHeader } },
    } as any);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const body = await req.json().catch(() => null);

    if (!body || !body.broadcasterId) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const broadcasterId = body.broadcasterId as string;

    if (broadcasterId === userId) {
      return new Response(JSON.stringify({ error: "You cannot vote for yourself" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    const { data: cycle, error: cycleError } = await supabaseAdmin
      .from("officer_vote_cycles")
      .select("id, starts_at, ends_at, status")
      .eq("status", "active")
      .lte("starts_at", now)
      .gte("ends_at", now)
      .maybeSingle();

    if (cycleError || !cycle) {
      return new Response(JSON.stringify({ error: "No active voting cycle" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: broadcaster, error: broadcasterError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, is_broadcaster, is_banned")
      .eq("id", broadcasterId)
      .maybeSingle();

    if (broadcasterError || !broadcaster || broadcaster.is_banned || !broadcaster.is_broadcaster) {
      return new Response(JSON.stringify({ error: "Invalid broadcaster" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: existingVote } = await supabaseAdmin
      .from("officer_votes")
      .select("id")
      .eq("cycle_id", cycle.id)
      .eq("voter_id", userId)
      .eq("broadcaster_id", broadcasterId)
      .maybeSingle();

    if (existingVote) {
      return new Response(JSON.stringify({ success: true, alreadyVoted: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error: voteError } = await supabaseAdmin.from("officer_votes").insert({
      cycle_id: cycle.id,
      voter_id: userId,
      broadcaster_id: broadcasterId,
    });

    if (voteError) {
      return new Response(JSON.stringify({ error: "Failed to record vote" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("vote_for_officer error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

