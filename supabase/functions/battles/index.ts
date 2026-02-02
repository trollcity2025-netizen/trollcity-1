// supabase/functions/battles/index.ts
// Battle system with streams_participants integration
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

interface BattleAction {
  action: 'start_battle' | 'join_battle_slot' | 'leave_battle_slot' | 'end_battle';
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

    const body: BattleAction = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return withCors({ error: "Action is required" }, 400);
    }

    switch (action) {
      case 'start_battle': {
        const { stream_id, host_id, opponent_id } = body;
        const effectiveHostId = host_id || user.id;

        if (!stream_id) {
          return withCors({ error: "stream_id is required" }, 400);
        }

        // Verify stream exists
        const { data: stream, error: streamError } = await supabase
          .from("streams")
          .select("broadcaster_id, status")
          .eq("id", stream_id)
          .single();

        if (streamError || !stream) {
          return withCors({ error: "Stream not found" }, 404);
        }

        // Check for existing active battle
        const { data: existingBattle } = await supabase
          .from("battles")
          .select("id")
          .eq("stream_id", stream_id)
          .eq("status", "active")
          .maybeSingle();

        if (existingBattle) {
          return withCors({ error: "Battle already active for this stream" }, 400);
        }

        // Create battle
        const { data: battle, error: battleError } = await supabase
          .from("battles")
          .insert({
            stream_id,
            host_id: effectiveHostId,
            opponent_id: opponent_id || null,
            status: "active",
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (battleError) {
          console.error("Battle creation error:", battleError);
          return withCors({ error: battleError.message }, 400);
        }

        // Ensure host and opponent in streams_participants
        const participants = [
          {
            stream_id,
            user_id: effectiveHostId,
            role: "host",
            battle_side: "A",
            is_active: true,
          }
        ];

        if (opponent_id) {
          participants.push({
            stream_id,
            user_id: opponent_id,
            role: "opponent",
            battle_side: "B",
            is_active: true,
          });
        }

        // Upsert participants
        for (const p of participants) {
          await supabase
            .from("streams_participants")
            .upsert(p, {
              onConflict: "stream_id,user_id,role",
              ignoreDuplicates: false,
            });
        }

        // Fetch all participants
        const { data: allParticipants } = await supabase
          .from("streams_participants")
          .select("*")
          .eq("stream_id", stream_id)
          .eq("is_active", true);

        return withCors({ battle, participants: allParticipants || [] }, 200);
      }

      case 'join_battle_slot': {
        const { stream_id, user_id, desired_side, role } = body;
        const effectiveUserId = user_id || user.id;
        const effectiveRole = role || 'guest';
        const effectiveSide = desired_side || null;

        if (!stream_id) {
          return withCors({ error: "stream_id is required" }, 400);
        }

        // Check if battle exists
        const { data: battle } = await supabase
          .from("battles")
          .select("id, status, host_id, opponent_id")
          .eq("stream_id", stream_id)
          .eq("status", "active")
          .maybeSingle();

        // Determine battle_side if battle exists
        let battleSide = effectiveSide;
        if (battle && !battleSide) {
          if (effectiveUserId === battle.host_id) {
            battleSide = 'A';
          } else if (effectiveUserId === battle.opponent_id) {
            battleSide = 'B';
          }
        }

        // Upsert participant
        const { data: participant, error: upsertError } = await supabase
          .from("streams_participants")
          .upsert({
            stream_id,
            user_id: effectiveUserId,
            role: effectiveRole,
            battle_side: battleSide,
            is_active: true,
            left_at: null,
          }, {
            onConflict: "stream_id,user_id,role",
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (upsertError) {
          console.error("Participant upsert error:", upsertError);
          return withCors({ error: upsertError.message }, 400);
        }

        return withCors({ participant }, 200);
      }

      case 'leave_battle_slot': {
        const { stream_id, user_id } = body;
        const effectiveUserId = user_id || user.id;

        if (!stream_id) {
          return withCors({ error: "stream_id is required" }, 400);
        }

        // Mark participant as inactive
        const { error: updateError } = await supabase
          .from("streams_participants")
          .update({
            is_active: false,
            left_at: new Date().toISOString(),
          })
          .eq("stream_id", stream_id)
          .eq("user_id", effectiveUserId)
          .eq("is_active", true);

        if (updateError) {
          return withCors({ error: updateError.message }, 400);
        }

        return withCors({ success: true }, 200);
      }

      case 'end_battle': {
        const { battle_id } = body;

        if (!battle_id) {
          return withCors({ error: "battle_id is required" }, 400);
        }

        // Get battle
        const { data: battle, error: battleError } = await supabase
          .from("battles")
          .select("*")
          .eq("id", battle_id)
          .single();

        if (battleError || !battle) {
          return withCors({ error: "Battle not found" }, 404);
        }

        // Verify user is host or admin
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_admin, role")
          .eq("id", user.id)
          .single();

        const isAdmin = profile?.is_admin || profile?.role === 'admin';
        if (battle.host_id !== user.id && !isAdmin) {
          return withCors({ error: "Only host or admin can end battle" }, 403);
        }

        if (battle.status === "finished") {
          return withCors({ battle }, 200);
        }

        // Calculate totals from gifts
        const { data: hostGifts } = await supabase
          .from("gifts")
          .select("coins_spent")
          .eq("battle_id", battle_id)
          .eq("receiver_id", battle.host_id);

        const { data: opponentGifts } = await supabase
          .from("gifts")
          .select("coins_spent")
          .eq("battle_id", battle_id)
          .eq("receiver_id", battle.opponent_id);

        const hostTotal = hostGifts?.reduce((sum, g) => sum + (g.coins_spent || 0), 0) || 0;
        const opponentTotal = opponentGifts?.reduce((sum, g) => sum + (g.coins_spent || 0), 0) || 0;

        let winnerSide: 'A' | 'B' | null = null;
        if (hostTotal > opponentTotal) {
          winnerSide = 'A';
        } else if (opponentTotal > hostTotal) {
          winnerSide = 'B';
        }

        // Update battle
        const { data: updated, error: updateError } = await supabase
          .from("battles")
          .update({
            status: "finished",
            host_gift_total: hostTotal,
            opponent_gift_total: opponentTotal,
            winner_side: winnerSide,
            ended_at: new Date().toISOString(),
          })
          .eq("id", battle_id)
          .select()
          .single();

        if (updateError) {
          console.error("Battle update error:", updateError);
          return withCors({ error: updateError.message }, 400);
        }

        // Mark all participants as inactive
        await supabase
          .from("streams_participants")
          .update({
            is_active: false,
            left_at: new Date().toISOString(),
          })
          .eq("stream_id", battle.stream_id)
          .eq("is_active", true);

        return withCors({ battle: updated }, 200);
      }

      default:
        return withCors({ error: "Invalid action" }, 400);
    }
  } catch (e) {
    console.error("Battles function error:", e);
    return withCors({ error: "Internal error" }, 500);
  }
};

Deno.serve(handler);
