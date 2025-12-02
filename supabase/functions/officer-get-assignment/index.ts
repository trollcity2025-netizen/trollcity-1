import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method !== "GET") {
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

    // Get active assignment
    const { data: assignment, error: fetchError } = await supabase
      .from("officer_live_assignments")
      .select(`
        id,
        stream_id,
        joined_at,
        last_activity,
        status,
        streams(title, host_id)
      `)
      .eq("officer_id", officerId)
      .eq("status", "active")
      .order("joined_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error("Error fetching assignment:", fetchError);
      return new Response("Failed to fetch assignment", { status: 500 });
    }

    return new Response(JSON.stringify({ 
      assignment: assignment || null 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in officer-get-assignment:", e);
    return new Response("Server error", { status: 500 });
  }
});

