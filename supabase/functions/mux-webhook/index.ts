import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const event = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    console.log("Mux event:", event.type);

    if (event.type === "video.live_stream.active") {
      await supabase
        .from("streams")
        .update({ is_live: true })
        .eq("mux_stream_id", event.data.id);
    }

    if (
      event.type === "video.live_stream.idle" ||
      event.type === "video.live_stream.disconnected"
    ) {
      await supabase
        .from("streams")
        .update({ is_live: false })
        .eq("mux_stream_id", event.data.id);
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Mux webhook error:", error);
    return new Response("error", { status: 500 });
  }
});
