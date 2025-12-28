// supabase/functions/troll-battle/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const url = new URL(req.url);
    const op = url.searchParams.get("op");

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (op === "start") {
      const body = await req.json().catch(() => ({}));
      const { challenger_id, host_stream_id, challenger_stream_id } = body;

      if (!challenger_id) {
        return new Response(JSON.stringify({ error: "challenger_id is required" }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const start = new Date();
      const end = new Date(start.getTime() + 2 * 60 * 1000); // 2 minutes

      const { data, error } = await supabase
        .from("troll_battles")
        .insert({
          host_id: user.id,
          challenger_id,
          host_stream_id,
          challenger_stream_id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "active"
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ battle: data }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (op === "apply-gift") {
      const body = await req.json().catch(() => ({}));
      const { battle_id, receiver_role, is_paid, amount } = body;

      if (!battle_id || !receiver_role || typeof amount !== "number") {
        return new Response(JSON.stringify({ error: "battle_id, receiver_role, amount required" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!["host", "challenger"].includes(receiver_role)) {
        return new Response(JSON.stringify({ error: "receiver_role must be host or challenger" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check battle is active and within time
      const { data: battle, error: battleError } = await supabase
        .from("troll_battles")
        .select("*")
        .eq("id", battle_id)
        .single();

      if (battleError || !battle) {
        return new Response(JSON.stringify({ error: "Battle not found" }), { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (battle.status !== "active") {
        return new Response(JSON.stringify({ error: "Battle not active" }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date();
      const endTime = new Date(battle.end_time);
      if (now > endTime) {
        return new Response(JSON.stringify({ error: "Battle already ended" }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update troll coin totals (skip trollmonds contributions)
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (is_paid) {
        const column =
          receiver_role === "host"
            ? "host_troll_coins"
            : "challenger_troll_coins";
        const currentValue =
          receiver_role === "host"
            ? battle.host_troll_coins || 0
            : battle.challenger_troll_coins || 0;
        updates[column] = currentValue + amount;
      }

      const { error: updateError } = await supabase
        .from("troll_battles")
        .update(updates)
        .eq("id", battle_id);

      if (updateError) {
        console.error(updateError);
        return new Response(JSON.stringify({ error: updateError.message }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Log gift for history (optional)
      await supabase.from("troll_battle_gifts").insert({
        battle_id,
        sender_id: user.id,
        receiver_role,
        is_paid: !!is_paid,
        amount
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (op === "complete") {
      const body = await req.json().catch(() => ({}));
      const { battle_id } = body;

      if (!battle_id) {
        return new Response(JSON.stringify({ error: "battle_id required" }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: battle, error: battleError } = await supabase
        .from("troll_battles")
        .select("*")
        .eq("id", battle_id)
        .single();

      if (battleError || !battle) {
        return new Response(JSON.stringify({ error: "Battle not found" }), { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (battle.status === "completed") {
        return new Response(JSON.stringify({ battle }), { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date();
      const endTime = new Date(battle.end_time);
      if (now < endTime) {
        // You can enforce waiting until the time is actually up.
        // For now we allow early completion if the client calls it.
        console.log("Completing battle before natural end_time");
      }

      let winner_id: string | null = null;
      const hostTotal = battle.host_troll_coins || 0;
      const challengerTotal = battle.challenger_troll_coins || 0;
      
      if (hostTotal > challengerTotal) {
        winner_id = battle.host_id;
      } else if (challengerTotal > hostTotal) {
        winner_id = battle.challenger_id;
      } else {
        // tie → no winner
        winner_id = null;
      }

      const { data: updated, error: updateError } = await supabase
        .from("troll_battles")
        .update({
          status: "completed",
          winner_id,
          updated_at: new Date().toISOString()
        })
        .eq("id", battle_id)
        .select()
        .single();

      if (updateError) {
        console.error(updateError);
        return new Response(JSON.stringify({ error: updateError.message }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create battle history and rewards
      if (updated) {
        // Battle history
        const duration = Math.floor((new Date(updated.end_time || updated.updated_at).getTime() - new Date(updated.start_time).getTime()) / 1000);
        
        // Host history
        const hostPaidSent = await supabase
          .from('troll_battle_gifts')
          .select('amount')
          .eq('battle_id', battle_id)
          .eq('sender_id', updated.host_id)
          .eq('is_paid', true);
        
        await supabase.from('battle_history').insert({
          battle_id: updated.id,
          user_id: updated.host_id,
          opponent_id: updated.challenger_id,
          won: winner_id === updated.host_id,
          paid_coins_received: updated.host_troll_coins,
          paid_coins_sent: hostPaidSent.data?.reduce((sum, g) => sum + (g.amount || 0), 0) || 0,
          battle_duration_seconds: duration,
        });

        // Challenger history
        const challengerPaidSent = await supabase
          .from('troll_battle_gifts')
          .select('amount')
          .eq('battle_id', battle_id)
          .eq('sender_id', updated.challenger_id)
          .eq('is_paid', true);
        
        await supabase.from('battle_history').insert({
          battle_id: updated.id,
          user_id: updated.challenger_id,
          opponent_id: updated.host_id,
          won: winner_id === updated.challenger_id,
          paid_coins_received: updated.challenger_troll_coins,
          paid_coins_sent: challengerPaidSent.data?.reduce((sum, g) => sum + (g.amount || 0), 0) || 0,
          battle_duration_seconds: duration,
        });

        // Rewards for winner
        if (winner_id) {
          await supabase.from('battle_rewards').insert([
            {
              battle_id: updated.id,
              user_id: winner_id,
              reward_type: 'badge',
              badge_name: 'Battle Champion',
            },
            {
              battle_id: updated.id,
              user_id: winner_id,
              reward_type: 'coin_multiplier',
              reward_value: 1.10, // 10% bonus
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            },
          ]);
        }
      }

      return new Response(JSON.stringify({ battle: updated }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: "Invalid op" }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal error" }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

Deno.serve(handler);

