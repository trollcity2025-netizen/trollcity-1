import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from "../_shared/cors.ts"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (_req) => {
  if (_req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting cron tasks...')

    // 1. Decay Broadcast Levels
    const { error: decayError } = await supabase.rpc('decay_broadcast_levels')
    if (decayError) {
        console.error('Error decaying broadcast levels:', decayError)
    } else {
        console.log('Broadcast levels decayed successfully')
    }

    // 2. Process Admin Queue
    const { error: queueError } = await supabase.rpc('process_admin_queue')
    if (queueError) {
        console.error('Error processing admin queue:', queueError)
    } else {
        console.log('Admin queue processed successfully')
    }

    // 3. Check Loan Defaults
    const { error: loanError } = await supabase.rpc('check_loan_defaults')
    if (loanError) {
        console.error('Error checking loan defaults:', loanError)
    } else {
        console.log('Loan defaults checked successfully')
    }

    // 4. Enforce LMPM Durations
    const { data: lmpmResult, error: lmpmError } = await supabase.rpc('enforce_lmpm_durations')
    if (lmpmError) {
        console.error('Error enforcing LMPM durations:', lmpmError)
    } else if (lmpmResult?.total_ended > 0) {
        console.log(`LMPM: Auto-ended ${lmpmResult.ended_streams} streams and ${lmpmResult.ended_pods} pods.`)
    }

    // 5. End Stale Battles
    const { error: staleBattlesError } = await supabase.rpc('end_stale_battles')
    if (staleBattlesError) {
        console.error('Error ending stale battles:', staleBattlesError)
    } else {
        console.log('Stale battles ended successfully')
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Cron task failed:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
