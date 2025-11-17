import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    const { streamId, userId, action } = await req.json()

    if (!streamId || !userId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Get user profile to check if they're admin
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_admin, role, username, full_name')
      .eq('id', userId)
      .single()

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    // Skip tracking for admin users to hide them from viewer count
    const isAdmin = userProfile.is_admin === true || userProfile.role === 'admin'
    if (isAdmin && action === 'join') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Admin user joined - not tracked in viewer count',
          isAdmin: true 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'join') {
      // Check if viewer already exists
      const { data: existingViewer } = await supabaseClient
        .from('stream_viewers')
        .select('id')
        .eq('stream_id', streamId)
        .eq('user_id', userId)
        .single()

      if (!existingViewer) {
        // Create new viewer record
        const { error: insertError } = await supabaseClient
          .from('stream_viewers')
          .insert({
            stream_id: streamId,
            user_id: userId,
            joined_at: new Date().toISOString(),
            last_heartbeat: new Date().toISOString()
          })

        if (insertError) {
          throw insertError
        }
      }

      // Add user entry message to chat (for both admin and regular users)
      const { error: chatError } = await supabaseClient
        .from('chat_messages')
        .insert({
          stream_id: streamId,
          user_id: userId,
          username: userProfile.username || userProfile.full_name || 'User',
          message: `${userProfile.username || userProfile.full_name || 'User'} entered the broadcast`,
          message_type: 'system',
          created_date: new Date().toISOString()
        })

      if (chatError) {
        console.error('Failed to add chat entry message:', chatError)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Viewer joined stream',
          isAdmin: false 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )

    } else if (action === 'leave') {
      // Remove viewer record
      const { error: deleteError } = await supabaseClient
        .from('stream_viewers')
        .delete()
        .eq('stream_id', streamId)
        .eq('user_id', userId)

      if (deleteError) {
        throw deleteError
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Viewer left stream' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )

    } else if (action === 'heartbeat') {
      // Update viewer heartbeat
      const { error: updateError } = await supabaseClient
        .from('stream_viewers')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('stream_id', streamId)
        .eq('user_id', userId)

      if (updateError) {
        throw updateError
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Heartbeat updated' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error('Error in trackStreamViewer:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})