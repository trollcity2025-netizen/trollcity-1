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
        
        // If we ended streams in the DB, we should also try to close the rooms in LiveKit
        // This is a secondary safety net as the frontend also has a timer.
        try {
          const livekitUrl = Deno.env.get("LIVEKIT_URL")?.replace('wss://', 'https://');
          const apiKey = Deno.env.get("LIVEKIT_API_KEY");
          const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
          
          if (livekitUrl && apiKey && apiSecret) {
            // We'd need the list of stream IDs that were ended to close specific rooms
            // For now, the DB update will trigger room_finished eventually or 
            // the next token request will fail.
          }
        } catch (lkErr) {
          console.error('Failed to close LiveKit rooms via cron:', lkErr);
        }
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
