
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.15.0'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Internal Service Functions ---

async function fillPerformerSlots(supabaseClient: any, sessionId: string) {
  const slots = ['A', 'B'];
  for (const slot of slots) {
    // Check if slot is already filled
    const { data: existingSlot, error: existingSlotError } = await supabaseClient
      .from('mai_stage_slots')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('slot', slot)
      .single();

    if (existingSlotError && existingSlotError.code !== 'PGRST116') throw existingSlotError;

    if (!existingSlot) {
      // Find the next user in the queue
      const { data: nextPerformer, error: queueError } = await supabaseClient
        .from('mai_queue')
        .select('user_id')
        .eq('session_id', sessionId)
        .eq('status', 'waiting')
        .order('position', { ascending: true })
        .limit(1)
        .single();

      if (queueError && queueError.code !== 'PGRST116') throw queueError;

      if (nextPerformer) {
        // Transaction to ensure atomicity
        const { error: transactionError } = await supabaseClient.rpc('fill_stage_slot', {
          p_session_id: sessionId,
          p_user_id: nextPerformer.user_id,
          p_slot: slot
        });

        if (transactionError) {
          console.error(`Error filling slot ${slot}:`, transactionError);
          // Continue to next slot if one fails
          continue;
        }

        // TODO: Start performance timer
      }
    }
  }
}

// --- Main Handler ---

serve(async (req) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { command, payload } = await req.json()
    const { sessionId, userId } = payload

    switch (command) {
      case 'join-queue': {
        // Get the current max position in the queue for this session
        const { data: maxPos, error: maxPosError } = await supabaseClient
          .from('mai_queue')
          .select('position')
          .eq('session_id', sessionId)
          .order('position', { ascending: false })
          .limit(1)
          .single()

        if (maxPosError && maxPosError.code !== 'PGRST116') { // Ignore 'not found' error
          throw maxPosError
        }

        const nextPosition = (maxPos?.position || 0) + 1

        // Insert the user into the queue
        const { error: insertError } = await supabaseClient.from('mai_queue').insert({
          session_id: sessionId,
          user_id: userId,
          position: nextPosition,
        })

        // Handle potential duplicate entry gracefully
        if (insertError && insertError.code === '23505') { // Unique violation
          return new Response(JSON.stringify({ message: 'User already in queue' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          })
        }
        if (insertError) throw insertError

        return new Response(JSON.stringify({ message: 'Successfully joined queue' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      case 'leave-queue': {
        const { error: deleteError } = await supabaseClient
          .from('mai_queue')
          .delete()
          .eq('session_id', sessionId)
          .eq('user_id', userId)

        if (deleteError) throw deleteError

        // Note: Re-ordering the queue positions after someone leaves can be complex
        // and might be better handled in a dedicated database function or trigger for atomicity.
        // For now, we'll leave it as is, and the slot filling logic will just grab the lowest position.

        return new Response(JSON.stringify({ message: 'Successfully left queue' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      case 'leave-stage': {
        // This command is for a performer leaving the stage, either voluntarily or by timer.
        const { error: transactionError } = await supabaseClient.rpc('leave_stage_and_fill_next', {
          p_session_id: sessionId,
          p_user_id: userId
        });

        if (transactionError) throw transactionError;

        return new Response(JSON.stringify({ message: 'Successfully left stage and rotated queue' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'start-show': {
        // TODO: Add host role check
        const { error } = await supabaseClient
          .from('mai_show_sessions')
          .update({ status: 'live' })
          .eq('id', sessionId);
        if (error) throw error;
        // Initial fill of performer slots when show starts
        await fillPerformerSlots(supabaseClient, sessionId);
        return new Response(JSON.stringify({ message: 'Show started' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'end-show': {
        // TODO: Add host role check
        const { error } = await supabaseClient
          .from('mai_show_sessions')
          .update({ status: 'ended' })
          .eq('id', sessionId);
        if (error) throw error;
        return new Response(JSON.stringify({ message: 'Show ended' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default: {
        return new Response(JSON.stringify({ error: 'Invalid command' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
