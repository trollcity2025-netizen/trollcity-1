import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase environment variables not found, platform fees API will be disabled')
}

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
}) : null

const router = Router()

// Charge 1% weekly platform fee
router.post('/charge-platform-fees', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        error: 'Platform fees service unavailable',
        details: 'Supabase configuration missing'
      })
    }

    const feeRate = 0.01 // 1% fee
    const minBalance = 100 // Minimum balance to charge fees
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    // Get users who need to be charged
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, paid_coin_balance, platform_fee_last_charged')
      .gte('paid_coin_balance', minBalance)
      .or(`platform_fee_last_charged.is.null,platform_fee_last_charged.lt.${weekAgo.toISOString()}`)

    if (usersError) throw usersError

    let chargedUsers = 0
    let totalFees = 0

    for (const user of users || []) {
      // Calculate 1% fee, minimum 1 coin
      const feeAmount = Math.max(1, Math.round(user.paid_coin_balance * feeRate))
      const newBalance = user.paid_coin_balance - feeAmount

      // Update user balance
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          paid_coin_balance: newBalance,
          platform_fee_last_charged: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        console.error(`Failed to update balance for user ${user.id}:`, updateError)
        continue
      }

      // Record the fee transaction
      const { error: feeError } = await supabase
        .from('platform_fees')
        .insert({
          user_id: user.id,
          fee_amount: feeAmount,
          balance_before: user.paid_coin_balance,
          balance_after: newBalance,
          created_at: new Date().toISOString()
        })

      if (feeError) {
        console.error(`Failed to record fee for user ${user.id}:`, feeError)
        continue
      }

      // Record transaction for user history
      const { error: transactionError } = await supabase
        .from('coin_transactions')
        .insert({
          user_id: user.id,
          type: 'platform_fee',
          amount: -feeAmount,
          description: 'Weekly platform fee (1%)',
          created_at: new Date().toISOString()
        })

      if (transactionError) {
        console.error(`Failed to record transaction for user ${user.id}:`, transactionError)
        continue
      }

      chargedUsers++
      totalFees += feeAmount
    }

    res.json({ 
      success: true, 
      chargedUsers, 
      totalFees,
      message: `Charged platform fees for ${chargedUsers} users, total: ${totalFees} coins`
    })

  } catch (error) {
    console.error('Platform fee charging error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to charge platform fees',
      details: error.message 
    })
  }
})

// Get platform fee history for admin
router.get('/platform-fees', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        error: 'Platform fees service unavailable',
        details: 'Supabase configuration missing'
      })
    }

    const { data: fees, error } = await supabase
      .from('platform_fees')
      .select(`
        *,
        user_profiles!inner(username)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    res.json({ success: true, fees })
  } catch (error) {
    console.error('Error fetching platform fees:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch platform fees',
      details: error.message 
    })
  }
})

export default router