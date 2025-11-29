// File: /api/wheel.ts  (Vercel serverless function)

import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({})
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL!
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Get user from auth header
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { spin_cost = 50 } = req.body || {}

    // Get user's coin balance
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    const totalCoins = (profile.paid_coin_balance || 0) + (profile.free_coin_balance || 0)
    if (totalCoins < spin_cost) {
      return res.status(400).json({ error: 'Insufficient coins' })
    }

    // Get wheel slices
    const { data: slices, error: slicesError } = await supabaseClient
      .from('wheel_slices')
      .select('*')
      .order('id')

    if (slicesError || !slices || slices.length === 0) {
      return res.status(500).json({ error: 'Wheel not configured' })
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
      return res.status(500).json({ error: 'Failed to update balance' })
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

    return res.status(200).json({
      success: true,
      result: {
        slice: selectedSlice,
        coins_awarded: coinsAwarded,
        is_jackpot: isJackpot,
        new_balance: newPaidBalance + newFreeBalance
      }
    })

  } catch (error) {
    console.error('Wheel error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}