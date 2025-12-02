// Supabase Edge Function - Admin Scheduler
// Runs every minute to check and send scheduled announcements
// Schedule: * * * * * (every minute)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date().toISOString()

    // Get pending announcements that are due
    const { data: pending, error: fetchError } = await supabase
      .from('scheduled_announcements')
      .select('*')
      .eq('is_sent', false)
      .lte('scheduled_time', now)

    if (fetchError) {
      console.error('Error fetching scheduled announcements:', fetchError)
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending announcements', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send each pending announcement
    const results = []
    for (const announcement of pending) {
      try {
        // Insert into admin_broadcasts (triggers real-time event)
        const { error: broadcastError } = await supabase
          .from('admin_broadcasts')
          .insert([{ 
            message: announcement.message,
            admin_id: announcement.created_by 
          }])

        if (broadcastError) {
          console.error('Error broadcasting announcement:', broadcastError)
          results.push({ id: announcement.id, status: 'error', error: broadcastError.message })
          continue
        }

        // Mark as sent
        const { error: updateError } = await supabase
          .from('scheduled_announcements')
          .update({ is_sent: true })
          .eq('id', announcement.id)

        if (updateError) {
          console.error('Error updating announcement status:', updateError)
          results.push({ id: announcement.id, status: 'broadcast_sent_but_update_failed' })
        } else {
          results.push({ id: announcement.id, status: 'sent' })
        }
      } catch (err: any) {
        console.error('Error processing announcement:', err)
        results.push({ id: announcement.id, status: 'error', error: err.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${results.length} announcements`,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Scheduler error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

