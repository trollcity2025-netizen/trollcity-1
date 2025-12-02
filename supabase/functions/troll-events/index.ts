// supabase/functions/troll-events/index.ts
// Red/Green Troll events system
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

interface TrollEventAction {
  action: 'schedule_daily_events' | 'trigger_random_event' | 'claim_event';
  [key: string]: any;
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight();
  }

  try {
    const body: TrollEventAction = await req.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      case 'schedule_daily_events': {
        // Find active streams
        const { data: activeStreams } = await supabase
          .from("streams")
          .select("id")
          .eq("is_live", true)
          .limit(100);

        if (!activeStreams || activeStreams.length === 0) {
          return withCors({ message: "No active streams", events_created: 0 }, 200);
        }

        // Create up to 10 random events today
        const eventsToCreate = Math.min(10, activeStreams.length);
        const events = [];
        const now = new Date();

        for (let i = 0; i < eventsToCreate; i++) {
          const randomStream = activeStreams[Math.floor(Math.random() * activeStreams.length)];
          const eventType = Math.random() > 0.5 ? 'red' : 'green';
          const startedAt = new Date(now.getTime() + i * 60000); // Stagger by 1 minute
          const expiresAt = new Date(startedAt.getTime() + 60 * 1000); // 1 minute duration

          events.push({
            stream_id: randomStream.id,
            event_type: eventType,
            coin_reward: 10,
            max_clicks: 9999,
            started_at: startedAt.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        }

        const { data: createdEvents, error: insertError } = await supabase
          .from("troll_events")
          .insert(events)
          .select();

        if (insertError) {
          console.error("Event creation error:", insertError);
          return withCors({ error: insertError.message }, 400);
        }

        return withCors({ events_created: createdEvents?.length || 0, events: createdEvents }, 200);
      }

      case 'trigger_random_event': {
        // Find one random active stream
        const { data: activeStreams } = await supabase
          .from("streams")
          .select("id")
          .eq("is_live", true)
          .limit(100);

        if (!activeStreams || activeStreams.length === 0) {
          return withCors({ error: "No active streams" }, 404);
        }

        const randomStream = activeStreams[Math.floor(Math.random() * activeStreams.length)];
        const eventType = Math.random() > 0.5 ? 'red' : 'green';
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 1000); // 1 minute

        const { data: event, error: insertError } = await supabase
          .from("troll_events")
          .insert({
            stream_id: randomStream.id,
            event_type: eventType,
            coin_reward: 10,
            max_clicks: 9999,
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error("Event creation error:", insertError);
          return withCors({ error: insertError.message }, 400);
        }

        return withCors({ event }, 200);
      }

      case 'claim_event': {
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

        const { event_id } = body;

        if (!event_id) {
          return withCors({ error: "event_id is required" }, 400);
        }

        // Get event
        const { data: event, error: eventError } = await supabase
          .from("troll_events")
          .select("*")
          .eq("id", event_id)
          .single();

        if (eventError || !event) {
          return withCors({ error: "Event not found" }, 404);
        }

        // Check if event is still valid
        const now = new Date();
        const startedAt = new Date(event.started_at);
        const expiresAt = new Date(event.expires_at);

        if (now < startedAt || now > expiresAt) {
          return withCors({ error: "Event has expired or not started yet" }, 400);
        }

        // Check if already claimed
        const { data: existingClaim } = await supabase
          .from("troll_event_claims")
          .select("id")
          .eq("event_id", event_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingClaim) {
          return withCors({ error: "Event already claimed" }, 400);
        }

        // Create claim
        const { error: claimError } = await supabase
          .from("troll_event_claims")
          .insert({
            event_id,
            user_id: user.id,
          });

        if (claimError) {
          console.error("Claim creation error:", claimError);
          return withCors({ error: claimError.message }, 400);
        }

        // Add coins to user
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("paid_coin_balance")
          .eq("id", user.id)
          .single();

        const newBalance = (profile?.paid_coin_balance || 0) + event.coin_reward;

        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({ paid_coin_balance: newBalance })
          .eq("id", user.id);

        if (updateError) {
          console.error("Balance update error:", updateError);
          return withCors({ error: "Failed to update balance" }, 400);
        }

        return withCors({
          success: true,
          coins_awarded: event.coin_reward,
          new_balance: newBalance,
        }, 200);
      }

      default:
        return withCors({ error: "Invalid action" }, 400);
    }
  } catch (e) {
    console.error("Troll events function error:", e);
    return withCors({ error: "Internal error" }, 500);
  }
};

Deno.serve(handler);

