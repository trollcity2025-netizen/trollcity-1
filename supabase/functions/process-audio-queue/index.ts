import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // PATCH: Update item status (completed / skipped)
    if (req.method === "PATCH") {
      const { item_id, status } = await req.json();

      if (!item_id || !status) {
        return new Response(
          JSON.stringify({ error: "item_id and status required" }),
          { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      if (!["completed", "skipped"].includes(status)) {
        return new Response(
          JSON.stringify({ error: "status must be 'completed' or 'skipped'" }),
          { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("audio_queue")
        .update(updateData)
        .eq("id", item_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ updated: data }),
        { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // POST: Fetch and process next audio item in queue
    if (req.method === "POST") {
      const { stream_id } = await req.json();

      if (!stream_id) {
        return new Response(
          JSON.stringify({ error: "stream_id required" }),
          { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      // Fetch queued audio items sorted by priority (highest first), then by creation time
      const { data: queueItems, error: fetchError } = await supabase
        .from("audio_queue")
        .select("*")
        .eq("stream_id", stream_id)
        .eq("status", "queued")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1);

      if (fetchError) throw fetchError;

      if (!queueItems || queueItems.length === 0) {
        return new Response(
          JSON.stringify({ queue_empty: true, item: null }),
          { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      const item = queueItems[0];

      // Mark the item as 'playing'
      const { data: updatedItem, error: updateError } = await supabase
        .from("audio_queue")
        .update({
          status: "playing",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          queue_empty: false,
          item: {
            id: updatedItem.id,
            stream_id: updatedItem.stream_id,
            audio_url: updatedItem.audio_url,
            title: updatedItem.title,
            priority: updatedItem.priority,
            status: updatedItem.status,
            metadata: updatedItem.metadata || {},
            started_at: updatedItem.started_at,
          },
        }),
        { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST to fetch or PATCH to update." }),
      { status: 405, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-audio-queue] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});
