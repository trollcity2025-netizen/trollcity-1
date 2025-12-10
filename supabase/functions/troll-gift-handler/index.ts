import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    const body = await req.json();

    const { sender_id, receiver_id, gift_value_paid, gift_id } = body;

    // Basic validation
    if (!sender_id || !receiver_id || !gift_value_paid) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Process the boosted gift using our RPC function
    const { data: result, error } = await supabase.rpc("process_boosted_gift", {
      p_sender: sender_id,
      p_receiver: receiver_id,
      p_gift_value: gift_value_paid,
      p_gift_id: gift_id || null,
    });

    if (error) {
      console.error("Gift processing error:", error);
      return new Response(JSON.stringify({ error: "Gift processing failed", details: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!result?.success) {
      return new Response(JSON.stringify({ error: result?.error || "Unknown error" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Server error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});