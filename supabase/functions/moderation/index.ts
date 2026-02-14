import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) })
  }

  try {
    const cors = corsHeaders(req.headers.get('origin'))
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_troll_officer, is_lead_officer, is_admin, role, is_banned')
      .eq('id', user.id)
      .single()

    const isOfficer = profile?.is_troll_officer || profile?.is_lead_officer || profile?.is_admin || profile?.role === 'admin' || profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer'


    const { action, ...payload } = await req.json()

    switch (action) {
      case 'submit_report': {
        const { reporter_id, target_user_id, stream_id, reason, description } = payload

        if (!reporter_id || !reason) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        // Verify reporter is the authenticated user
        if (reporter_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const { data, error } = await supabase
          .from('moderation_reports')
          .insert({
            reporter_id,
            target_user_id: target_user_id || null,
            stream_id: stream_id || null,
            reason,
            description: description || null,
            status: 'pending'
          })
          .select()
          .single()

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, report: data }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      case 'take_action': {
        if (!isOfficer) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Officer access required' }),
            { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const { report_id, action_type, target_user_id, stream_id, reason, action_details, expires_at, ban_duration_hours, honesty_message_shown } = payload

        if (!action_type || !reason || !reason.trim()) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: action_type and reason are required' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        // Update report status if report_id provided
        if (report_id) {
          await supabase
            .from('moderation_reports')
            .update({
              status: 'resolved',
              resolved_by: user.id,
              resolved_at: new Date().toISOString()
            })
            .eq('id', report_id)
        }

        // Calculate ban expiry
        let banExpiresAt = expires_at || null
        if (action_type === 'ban_user' && ban_duration_hours && !expires_at) {
          const expiryDate = new Date()
          expiryDate.setHours(expiryDate.getHours() + ban_duration_hours)
          banExpiresAt = expiryDate.toISOString()
        }

        // Create moderation action
        const { data: actionData, error: actionError } = await supabase
          .from('moderation_actions')
          .insert({
            action_type,
            action: action_type, // Syncing with legacy 'action' column
            target_user_id: target_user_id || null,
            reason: reason.trim(),
            details: action_details || null,
            officer_id: user.id,
            actor_id: user.id,
            ban_expires_at: banExpiresAt,
            ban_duration_hours: ban_duration_hours || null,
            honesty_message_shown: honesty_message_shown || false,
            report_id: report_id || null,
            status: 'active'
          })
          .select()
          .single()

        if (actionError) {
          return new Response(
            JSON.stringify({ error: actionError.message }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        // Apply action effects
        if (action_type === 'suspend_stream' && stream_id) {
          await supabase
            .from('streams')
            .update({ is_live: false })
            .eq('id', stream_id)
        }

        if (action_type === 'ban_user' && target_user_id) {
          // Use secure RPC for ban updates to bypass trigger protection
          const { error: rpcError } = await supabase.rpc('admin_update_ban_status', {
             p_target_user_id: target_user_id,
             p_is_banned: true,
             p_ban_expires_at: banExpiresAt || null
          })
          
          if (rpcError) {
             console.error("Ban RPC Error", rpcError)
             
             // Update moderation action to rejected status with error message
             if (actionData?.id) {
               await supabase
                 .from('moderation_actions')
                 .update({ 
                   status: 'rejected',
                   error_message: rpcError.message 
                 })
                 .eq('id', actionData.id)
             }

             return new Response(JSON.stringify({ error: rpcError.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
          }

          // Create notification for banned user with honesty message
          await supabase
            .from('notifications')
            .insert({
              user_id: target_user_id,
              type: 'moderation_action',
              title: 'Account Banned',
              message: `You have been banned. Reason: ${reason}. ${honesty_message_shown ? 'Being honest about why you were banned will help you get back on the app.' : ''}`,
              metadata: {
                action_id: actionData?.id,
                ban_expires_at: banExpiresAt,
                is_permanent: !banExpiresAt
              }
            })
        }

        if (action_type === 'unban_user' && target_user_id) {
          const { error: rpcError } = await supabase.rpc('admin_update_ban_status', {
             p_target_user_id: target_user_id,
             p_is_banned: false,
             p_ban_expires_at: null
          })

          if (rpcError) {
              console.error("Unban RPC Error", rpcError)
              
              // Update the unban action itself to rejected status
              if (actionData?.id) {
                await supabase
                  .from('moderation_actions')
                  .update({ 
                    status: 'rejected',
                    error_message: rpcError.message 
                  })
                  .eq('id', actionData.id)
              }

              return new Response(JSON.stringify({ error: rpcError.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
          }

          // Update moderation actions status to revoked
          await supabase
            .from('moderation_actions')
            .update({ status: 'revoked' })
            .eq('target_user_id', target_user_id)
            .eq('action_type', 'ban_user')
            .eq('status', 'active')
        }

        return new Response(
          JSON.stringify({ success: true, action: actionData }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      case 'list_reports': {
        if (!isOfficer) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Officer access required' }),
            { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const { status_filter } = payload

        let query = supabase
          .from('moderation_reports_view')
          .select('*')
          .order('created_at', { ascending: false })

        // Officers see pending + reviewing, admins see all
        if (profile?.role !== 'admin' && !profile?.is_admin) {
          query = query.in('status', ['pending', 'reviewing'])
        }

        if (status_filter) {
          query = query.eq('status', status_filter)
        }

        const { data, error } = await query

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, reports: data || [] }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      case 'reject_report': {
        if (!isOfficer) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Officer access required' }),
            { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const { report_id } = payload

        if (!report_id) {
          return new Response(
            JSON.stringify({ error: 'Missing report_id' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const { error } = await supabase
          .from('moderation_reports')
          .update({
            status: 'rejected',
            reviewed_by: user.id,
            resolved_at: new Date().toISOString()
          })
          .eq('id', report_id)

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})

