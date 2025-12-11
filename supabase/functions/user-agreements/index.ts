import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'accept_agreement': {
        const { agreement_version = '1.0' } = await req.json()

        // Get client IP and user agent
        const clientIP = req.headers.get('CF-Connecting-IP') ||
                        req.headers.get('X-Forwarded-For') ||
                        req.headers.get('X-Real-IP') ||
                        'unknown'

        const userAgent = req.headers.get('User-Agent') || 'unknown'

        // Record agreement acceptance
        const { data, error } = await supabaseClient.rpc('record_agreement_acceptance', {
          p_user_id: user.id,
          p_agreement_version: agreement_version,
          p_ip_address: clientIP,
          p_user_agent: userAgent
        })

        if (error) {
          console.error('Error recording agreement:', error)
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            agreement_id: data,
            message: 'Agreement accepted successfully'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      case 'check_agreement_status': {
        const { agreement_version = '1.0' } = await req.json()

        const { data, error } = await supabaseClient.rpc('has_accepted_agreement', {
          p_user_id: user.id,
          p_agreement_version: agreement_version
        })

        if (error) {
          console.error('Error checking agreement status:', error)
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            has_accepted: data,
            agreement_version
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      case 'get_user_agreements': {
        // Check if user is admin
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('role, is_admin')
          .eq('id', user.id)
          .single()

        const isAdmin = profile?.role === 'admin' || profile?.is_admin === true

        if (!isAdmin) {
          return new Response(
            JSON.stringify({ success: false, error: 'Admin access required' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        const { data, error } = await supabaseClient
          .from('user_agreements')
          .select('*')
          .order('accepted_at', { ascending: false })
          .limit(1000)

        if (error) {
          console.error('Error fetching agreements:', error)
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            agreements: data
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      case 'get_agreement_stats': {
        // Check if user is admin
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('role, is_admin')
          .eq('id', user.id)
          .single()

        const isAdmin = profile?.role === 'admin' || profile?.is_admin === true

        if (!isAdmin) {
          return new Response(
            JSON.stringify({ success: false, error: 'Admin access required' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        const { data, error } = await supabaseClient
          .from('agreement_stats')
          .select('*')
          .single()

        if (error) {
          console.error('Error fetching agreement stats:', error)
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            stats: data
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})