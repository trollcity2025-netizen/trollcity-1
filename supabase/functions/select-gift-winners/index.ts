import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : 10;

    const { data: candidates, error: listError } = await supabaseAdmin
      .from("user_gifts")
      .select("id, vote_count, status")
      .eq("status", "submitted")
      .order("vote_count", { ascending: false })
      .limit(limit);

    if (listError) {
      return new Response(JSON.stringify({ error: "Failed to load gifts" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ success: true, updated: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ids = candidates.map((g) => g.id);

    const { error: updateError } = await supabaseAdmin
      .from("user_gifts")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to approve gifts" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, updated: ids.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("select_gift_winners error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

