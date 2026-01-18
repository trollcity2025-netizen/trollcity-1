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

    if (!body || !body.giftId) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const giftId = body.giftId as string;

    const { data: gift, error: giftError } = await supabaseAdmin
      .from("user_gifts")
      .select("id, status, creator_id")
      .eq("id", giftId)
      .maybeSingle();

    if (giftError || !gift || gift.status !== "submitted") {
      return new Response(JSON.stringify({ error: "Gift not open for voting" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (gift.creator_id === userId) {
      return new Response(JSON.stringify({ error: "Creators cannot vote on own gift" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: existingVote } = await supabaseAdmin
      .from("gift_votes")
      .select("id")
      .eq("gift_id", giftId)
      .eq("voter_id", userId)
      .maybeSingle();

    if (existingVote) {
      return new Response(JSON.stringify({ success: true, alreadyVoted: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error: voteError } = await supabaseAdmin
      .from("gift_votes")
      .insert({
        gift_id: giftId,
        voter_id: userId,
      });

    if (voteError) {
      return new Response(JSON.stringify({ error: "Failed to record vote" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error: incrementError } = await supabaseAdmin.rpc("increment_gift_vote_count", {
      p_gift_id: giftId,
    });

    if (incrementError) {
      console.error("Failed to increment vote_count", incrementError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("vote_gift error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

