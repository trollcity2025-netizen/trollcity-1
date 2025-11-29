// supabase/functions/wheel/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { action = 'spin', spin_cost = 50 } = await req.json()

    if (action === 'spins-left') {
      // Check user's available spins (simplified)
      return new Response(JSON.stringify({ 
        success: true, 
        spins_left: 10 // Placeholder
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'spin') {
      // Get user's coin balance
      const { data: profile, error: profileError } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        return new Response(JSON.stringify({ error: 'Profile not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const totalCoins = (profile.paid_coin_balance || 0) + (profile.free_coin_balance || 0)
      if (totalCoins < spin_cost) {
        return new Response(JSON.stringify({ error: 'Insufficient coins' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get wheel slices
      const { data: slices, error: slicesError } = await supabaseClient
        .from('wheel_slices')
        .select('*')
        .order('id')

      if (slicesError || !slices || slices.length === 0) {
        return new Response(JSON.stringify({ error: 'Wheel not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Simple random selection based on probability
      const random = Math.random()
      let cumulativeProbability = 0
      let selectedSlice = slices[0] // Default to first slice

      for (const slice of slices) {
        cumulativeProbability += slice.probability
        if (random <= cumulativeProbability) {
          selectedSlice = slice
          break
        }
      }

      // Calculate rewards
      let coinsAwarded = 0
      let isJackpot = false

      if (selectedSlice.reward_type === 'coins') {
        coinsAwarded = selectedSlice.amount || 0
      } else if (selectedSlice.reward_type === 'jackpot') {
        coinsAwarded = selectedSlice.amount || 1000
        isJackpot = true
      } else if (selectedSlice.reward_type === 'spins') {
        // Award extra spin (handled client-side)
        coinsAwarded = 0
      } else if (selectedSlice.reward_type === 'nothing') {
        coinsAwarded = 0
      }

      // Deduct spin cost
      const newPaidBalance = Math.max(0, (profile.paid_coin_balance || 0) - spin_cost)
      const newFreeBalance = (profile.free_coin_balance || 0) + coinsAwarded

      // Update user balance
      const { error: updateError } = await supabaseClient
        .from('user_profiles')
        .update({
          paid_coin_balance: newPaidBalance,
          free_coin_balance: newFreeBalance,
          total_earned_coins: (profile.total_earned_coins || 0) + coinsAwarded,
          total_spent_coins: (profile.total_spent_coins || 0) + spin_cost
        })
        .eq('id', user.id)

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to update balance' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Record transaction
      await supabaseClient.from('coin_transactions').insert([
        {
          user_id: user.id,
          type: 'wheel_spin',
          amount: -spin_cost,
          description: 'Wheel spin cost',
          metadata: { is_jackpot: isJackpot, coins_awarded: coinsAwarded }
        },
        ...(coinsAwarded > 0 ? [{
          user_id: user.id,
          type: 'wheel_win',
          amount: coinsAwarded,
          description: `Wheel ${isJackpot ? 'JACKPOT' : 'win'}: ${selectedSlice.label}`,
          metadata: { is_jackpot: isJackpot, slice_id: selectedSlice.id }
        }] : [])
      ])

      return new Response(JSON.stringify({
        success: true,
        result: {
          slice: selectedSlice,
          coins_awarded: coinsAwarded,
          is_jackpot: isJackpot,
          new_balance: newPaidBalance + newFreeBalance
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Wheel error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
