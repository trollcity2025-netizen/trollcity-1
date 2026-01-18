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

    if (!body || !body.name || !body.config) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: app, error: appError } = await supabaseAdmin
      .from("trollg_applications")
      .select("id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (appError || !app || app.status !== "paid") {
      return new Response(JSON.stringify({ error: "TrollG fee not paid" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: existingGift } = await supabaseAdmin
      .from("user_gifts")
      .select("id, status")
      .eq("creator_id", userId)
      .maybeSingle();

    if (existingGift && existingGift.status === "submitted") {
      return new Response(JSON.stringify({ error: "Gift already submitted" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (existingGift && existingGift.status === "approved") {
      return new Response(JSON.stringify({ error: "Gift already approved" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const payload = {
      creator_id: userId,
      name: body.name,
      config: body.config,
      status: "submitted",
      vote_count: 0,
    };

    let giftId: string | null = null;

    if (existingGift) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("user_gifts")
        .update(payload)
        .eq("id", existingGift.id)
        .select("id")
        .single();

      if (updateError || !updated) {
        return new Response(JSON.stringify({ error: "Failed to submit gift" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      giftId = updated.id;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("user_gifts")
        .insert(payload)
        .select("id")
        .single();

      if (insertError || !inserted) {
        return new Response(JSON.stringify({ error: "Failed to submit gift" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      giftId = inserted.id;
    }

    const { error: eventError } = await supabaseAdmin
      .from("vote_events")
      .insert({
        event_type: "gift_submitted",
        user_id: userId,
        gift_id: giftId,
        is_active: true,
      });

    if (eventError) {
      console.error("Failed to create gift_submitted vote event", eventError);
    }

    return new Response(JSON.stringify({ success: true, giftId }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit_gift_for_voting error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

