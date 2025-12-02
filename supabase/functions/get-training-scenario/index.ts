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
    const { data, error } = await supabase
      .from("training_scenarios")
      .select("*")
      .order("RANDOM()")
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching scenario:", error);
      return new Response("Failed to fetch scenario", { status: 500 });
    }

    if (!data) {
      return new Response("No scenarios available", { status: 404 });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in get-training-scenario:", e);
    return new Response("Server error", { status: 500 });
  }
});

