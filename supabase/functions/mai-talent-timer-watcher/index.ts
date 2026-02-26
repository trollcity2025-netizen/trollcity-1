
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.15.0'

serve(async (_req) => {
  try {
    // Use the service role key for admin-level access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find all active timers that have ended
    const { data: expiredTimers, error: timerError } = await supabaseAdmin
      .from('mai_performance_timer')
      .select('session_id, performer_user_id')
      .eq('active', true)
      .lt('ends_at', 'now()')

    if (timerError) throw timerError

    if (expiredTimers && expiredTimers.length > 0) {
      console.log(`Found ${expiredTimers.length} expired timers. Processing...`);

      for (const timer of expiredTimers) {
        // For each expired timer, call the orchestrator to remove the performer
        const { error: rpcError } = await supabaseAdmin.rpc('leave_stage_and_fill_next', {
          p_session_id: timer.session_id,
          p_user_id: timer.performer_user_id
        });

        if (rpcError) {
          console.error(`Error processing timer for user ${timer.performer_user_id}:`, rpcError);
        } else {
          console.log(`Successfully processed timer for user ${timer.performer_user_id}.`);
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Timer check complete.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
