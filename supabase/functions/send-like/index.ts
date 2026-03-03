import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { stream_id } = await req.json()
    
    if (!stream_id) {
      return new Response(
        JSON.stringify({ error: 'Missing stream_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure user has a profile (fix for orphaned users)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      // Create missing profile with ID-based username (guaranteed unique)
      const { error: createProfileError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          username: `user${user.id.slice(0, 8)}`,
          avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          bio: 'New troll in the city!',
          role: user.email === 'trollcity2025@gmail.com' ? 'admin' : 'user',
          tier: 'Bronze',
          paid_coins: 0,
          troll_coins: 100,
          total_earned_coins: 100,
          total_spent_coins: 0,
          email: user.email,
          terms_accepted: false
        })
        .single()

      if (createProfileError) {
        console.error('Failed to create profile:', createProfileError)
        return new Response(
          JSON.stringify({ error: 'Failed to create user profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Call the database function to add like and potentially award coins
    const { data: result, error: rpcError } = await supabase.rpc('add_stream_like', {
      p_stream_id: stream_id,
      p_user_id: user.id
    })

    if (rpcError) {
      console.error('RPC Error:', rpcError)
      return new Response(
        JSON.stringify({ error: 'Failed to process like: ' + rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle both array result (from RETURNS TABLE) and direct object
    let likeData: any = null
    if (Array.isArray(result) && result.length > 0) {
      likeData = result[0]
    } else if (result && typeof result === 'object') {
      likeData = result
    }

    console.log('Like processed successfully:', likeData)

    return new Response(
      JSON.stringify({
        success: true,
        total_likes: likeData?.new_total_likes || likeData?.total_likes || 0,
        user_like_count: likeData?.user_like_count || likeData?.like_count || 0,
        coins_awarded: likeData?.coins_awarded || 0,
        total_coins_earned: likeData?.total_coins_earned || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
