// supabase/functions/streams-maintenance/index.ts
// Stream cleanup and maintenance
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

interface MaintenanceAction {
  action: 'end_stream' | 'cleanup_ghost_streams';
  [key: string]: any;
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight();
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return withCors({ error: "Missing authorization" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return withCors({ error: "Invalid user" }, 401);
    }

    const body: MaintenanceAction = await req.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      case 'end_stream': {
        const { stream_id, broadcaster_id } = body;
        const effectiveBroadcasterId = broadcaster_id || user.id;

        if (!stream_id) {
          return withCors({ error: "stream_id is required" }, 400);
        }

        // Verify user is broadcaster or admin
        const { data: stream } = await supabase
          .from("streams")
          .select("broadcaster_id")
          .eq("id", stream_id)
          .single();

        if (!stream) {
          return withCors({ error: "Stream not found" }, 404);
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_admin, role")
          .eq("id", user.id)
          .single();

        const isAdmin = profile?.is_admin || profile?.role === 'admin';
        if (stream.broadcaster_id !== user.id && !isAdmin) {
          return withCors({ error: "Only broadcaster or admin can end stream" }, 403);
        }

        // End stream
        const { error: streamError } = await supabase
          .from("streams")
          .update({
            is_live: false,
            ended_at: new Date().toISOString(),
          })
          .eq("id", stream_id);

        if (streamError) {
          return withCors({ error: streamError.message }, 400);
        }

        // Mark participants as inactive
        const { error: participantsError } = await supabase
          .from("streams_participants")
          .update({
            is_active: false,
            left_at: new Date().toISOString(),
          })
          .eq("stream_id", stream_id)
          .eq("is_active", true);

        return withCors({ success: true }, 200);
      }

      case 'cleanup_ghost_streams': {
        // Verify admin
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_admin, role")
          .eq("id", user.id)
          .single();

        const isAdmin = profile?.is_admin || profile?.role === 'admin';
        if (!isAdmin) {
          return withCors({ error: "Admin only" }, 403);
        }

        // Find ghost streams (is_live=true but no heartbeat in 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

        const { data: ghostStreams } = await supabase
          .from("streams")
          .select("id")
          .eq("is_live", true)
          .or(`last_heartbeat_at.is.null,last_heartbeat_at.lt.${twoMinutesAgo}`);

        if (!ghostStreams || ghostStreams.length === 0) {
          return withCors({ streams_ended: 0 }, 200);
        }

        const streamIds = ghostStreams.map(s => s.id);

        // End all ghost streams
        const { error: updateError } = await supabase
          .from("streams")
          .update({
            is_live: false,
            ended_at: new Date().toISOString(),
          })
          .in("id", streamIds);

        if (updateError) {
          return withCors({ error: updateError.message }, 400);
        }

        // Mark participants as inactive
        await supabase
          .from("streams_participants")
          .update({
            is_active: false,
            left_at: new Date().toISOString(),
          })
          .in("stream_id", streamIds)
          .eq("is_active", true);

        return withCors({ streams_ended: ghostStreams.length }, 200);
      }

      default:
        return withCors({ error: "Invalid action" }, 400);
    }
  } catch (e) {
    console.error("Streams maintenance error:", e);
    return withCors({ error: "Internal error" }, 500);
  }
};

Deno.serve(handler);

