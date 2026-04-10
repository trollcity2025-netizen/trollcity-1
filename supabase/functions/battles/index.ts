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
      case 'captain_click_battle': {
        const { stream_id } = body;
        
        if (!stream_id) {
          return withCors({ error: "stream_id is required" }, 400);
        }
        
        // ✅ AUTHORITATIVE - Everything happens inside database transaction
        // ✅ Auto collects current seated guests
        // ✅ Finds waiting opponent
        // ✅ Locks rosters
        // ✅ Sets scheduled start time
        const { data: result, error } = await supabase.rpc('captain_click_battle', {
          p_stream_id: stream_id,
          p_captain_id: user.id
        });
        
        if (error) {
          return withCors({ error: error.message }, 400);
        }
        
        return withCors(result, 200);
      }
      
      case 'cancel_battle_search': {
        const { stream_id } = body;
        await supabase.from('streams').update({
          looking_for_battle: false,
          looking_for_battle_since: null
        }).eq('id', stream_id);
        
        return withCors({ success: true }, 200);
      }
      
      case 'start_battle': {
        // ❌ DEPRECATED - USE captain_click_battle INSTEAD
        // Redirect all old start_battle calls to new handshake system
        const { stream_id } = body;
        const effectiveHostId = user.id;

        if (!stream_id) {
          return withCors({ error: "stream_id is required" }, 400);
        }
        
        // Redirect to new authoritative system
        const { data: result, error } = await supabase.rpc('captain_click_battle', {
          p_stream_id: stream_id,
          p_captain_id: effectiveHostId
        });
        
        if (error) {
          return withCors({ error: error.message }, 400);
        }
        
        return withCors(result, 200);
      }

        // Verify both streams exist and are live
        const { data: hostStream, error: hostStreamError } = await supabase
          .from("streams")
          .select("broadcaster_id, status")
          .eq("id", stream_id)
          .single();

        if (hostStreamError || !hostStream) {
          return withCors({ error: "Host stream not found" }, 404);
        }
        
        const { data: opponentStream, error: opponentStreamError } = await supabase
          .from("streams")
          .select("broadcaster_id, status")
          .eq("id", opponent_stream_id)
          .single();

        if (opponentStreamError || !opponentStream) {
          return withCors({ error: "Opponent stream not found" }, 404);
        }
        
        // Verify both streams are live
        if (hostStream.status !== 'live' || opponentStream.status !== 'live') {
          return withCors({ error: "Both streams must be live to start battle" }, 400);
        }

        // Check for existing active battle on either stream
        const { data: existingHostBattle } = await supabase
          .from("battles")
          .select("id")
          .or(`stream_id=eq.${stream_id},opponent_stream_id=eq.${stream_id}`)
          .eq("status", "active")
          .maybeSingle();
          
        const { data: existingOpponentBattle } = await supabase
          .from("battles")
          .select("id")
          .or(`stream_id=eq.${opponent_stream_id},opponent_stream_id=eq.${opponent_stream_id}`)
          .eq("status", "active")
          .maybeSingle();

        if (existingHostBattle || existingOpponentBattle) {
          return withCors({ error: "Battle already active for one of the streams" }, 400);
        }

        // Create battle with pending status first - wait for both broadcasters to confirm ready
        const battleStartTime = new Date();
        battleStartTime.setSeconds(battleStartTime.getSeconds() + 10); // 10 second countdown
        
        const { data: battle, error: battleError } = await supabase
          .from("battles")
          .insert({
            stream_id,
            opponent_stream_id,
            host_id: effectiveHostId,
            opponent_id: opponent_id,
            status: "pending",
            scheduled_start_at: battleStartTime.toISOString(),
            host_ready: false,
            opponent_ready: false,
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

      case 'cancel_battle_search': {
        const { stream_id } = body;
        await supabase.from('streams').update({
          looking_for_battle: false,
          looking_for_battle_since: null
        }).eq('id', stream_id);
        
        await supabase.from('battles').update({
          status: 'cancelled'
        }).or(`team_a_stream_id=eq.${stream_id},team_b_stream_id=eq.${stream_id}`)
          .eq('status', 'waiting_for_opponent');
        
        return withCors({ success: true }, 200);
      }
        
        const { data: updatedBattle, error: updateError } = await supabase
          .from("battles")
          .update(updateData)
          .eq("id", battle_id)
          .select()
          .single();
          
        if (updateError) {
          return withCors({ error: updateError.message }, 400);
        }
        
        return withCors({ battle: updatedBattle, both_ready: hostWillBeReady && opponentWillBeReady }, 200);
      }
      
      case 'forfeit_battle': {
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
        
        // Determine forfeit side
        const forfeitingSide = user.id === battle.host_id ? 'A' : 'B';
        const winningSide = forfeitingSide === 'A' ? 'B' : 'A';
        
        // End battle with forfeit
        const { data: updatedBattle } = await supabase
          .from("battles")
          .update({
            status: "finished",
            ended_at: new Date().toISOString(),
            winner_side: winningSide,
            forfeit: true,
            forfeiting_side: forfeitingSide
          })
          .eq("id", battle_id)
          .select()
          .single();
        
        // Award 2 crowns to winning host
        const winningHostId = winningSide === 'A' ? battle.host_id : battle.opponent_id;
        await supabase.rpc('award_battle_crowns', { user_id: winningHostId, amount: 2 });
        
        // Clear battle flags on both streams
        await Promise.all([
          supabase.from('streams').update({
            is_battle: false,
            battle_id: null
          }).eq('id', battle.stream_id),
          supabase.from('streams').update({
            is_battle: false,
            battle_id: null
          }).eq('id', battle.opponent_stream_id),
        ]);
        
        // Broadcast forfeit event to ALL connected clients
        const battleChannel = supabase.channel(`battle:${battle.id}`);
        await battleChannel.send({
          type: 'broadcast',
          event: 'battle_forfeited',
          payload: {
            winner: winningSide,
            forfeiter: forfeitingSide,
            crownsAwarded: 2,
            endBattle: true,
            redirectToBroadcast: true
          }
        });
        
        // Also send to both individual stream channels
        await supabase.channel(`stream:${battle.stream_id}`).send({
          type: 'broadcast',
          event: 'battle_ended',
          payload: { winner: winningSide, victory: winningSide === 'A' }
        });
        
        await supabase.channel(`stream:${battle.opponent_stream_id}`).send({
          type: 'broadcast',
          event: 'battle_ended',
          payload: { winner: winningSide, victory: winningSide === 'B' }
        });
        
        return withCors({ 
          battle: updatedBattle, 
          winner: winningSide, 
          forfeiter: forfeitingSide 
        }, 200);
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
