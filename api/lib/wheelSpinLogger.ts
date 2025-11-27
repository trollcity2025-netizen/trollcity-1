import { createClient } from '@supabase/supabase-js'
import { logCoinTransaction } from './coinTransactionLogger.js'

/**
 * Wheel Spins Logger
 * Tracks all Troll Wheel spins, outcomes, and prizes
 */

interface WheelSpinParams {
  userId: string
  costCoins: number
  outcome: string // 'jackpot', 'insurance', 'multiplier', 'nothing', 'free_coins', etc.
  prizeCoins?: number
  metadata?: Record<string, any>
}

interface WheelSpinResult {
  success: boolean
  spinId?: string
  error?: any
}

interface WheelSpin {
  id: string
  user_id: string
  cost_coins: number
  outcome: string
  prize_coins: number
  metadata: any
  created_at: string
}

/**
 * Log a wheel spin and handle coin transactions
 */
export async function logWheelSpin(params: WheelSpinParams): Promise<WheelSpinResult> {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  const {
    userId,
    costCoins,
    outcome,
    prizeCoins = 0,
    metadata = {}
  } = params

  try {
    // 1. Deduct spin cost from user's balance
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance, free_coin_balance')
      .eq('id', userId)
      .single()

    if (!profile) {
      return { success: false, error: 'User profile not found' }
    }

    const paidBalance = profile.paid_coin_balance || 0
    const freeBalance = profile.free_coin_balance || 0
    const totalBalance = paidBalance + freeBalance

    if (totalBalance < costCoins) {
      return { success: false, error: 'Insufficient coins' }
    }

    // Deduct from paid first, then free
    let paidDebit = 0
    let freeDebit = 0

    if (paidBalance >= costCoins) {
      paidDebit = costCoins
      await supabase
        .from('user_profiles')
        .update({ paid_coin_balance: paidBalance - costCoins })
        .eq('id', userId)
    } else {
      paidDebit = paidBalance
      freeDebit = costCoins - paidBalance
      await supabase
        .from('user_profiles')
        .update({
          paid_coin_balance: 0,
          free_coin_balance: freeBalance - freeDebit
        })
        .eq('id', userId)
    }

    // 2. Log the wheel spin
    const { data: spin, error: spinError } = await supabase
      .from('wheel_spins')
      .insert({
        user_id: userId,
        cost_coins: costCoins,
        outcome,
        prize_coins: prizeCoins,
        metadata
      })
      .select()
      .single()

    if (spinError) {
      console.error('Failed to log wheel spin:', spinError)
      return { success: false, error: spinError }
    }

    console.log('Wheel spin logged:', {
      id: spin.id,
      user: userId,
      cost: costCoins,
      outcome,
      prize: prizeCoins
    })

    // 3. Log the spin cost transaction
    await logCoinTransaction({
      userId,
      amount: -costCoins,
      coinType: paidDebit > 0 ? 'paid' : 'free',
      transactionType: 'wheel_spin',
      source: 'troll_wheel',
      description: `Troll Wheel spin - ${outcome}`,
      metadata: {
        spin_id: spin.id,
        outcome,
        paid_debit: paidDebit,
        free_debit: freeDebit
      }
    })

    // 4. If user won coins, credit them
    if (prizeCoins > 0) {
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('free_coin_balance')
        .eq('id', userId)
        .single()

      const currentFreeBalance = updatedProfile?.free_coin_balance || 0
      const newFreeBalance = currentFreeBalance + prizeCoins

      await supabase
        .from('user_profiles')
        .update({ free_coin_balance: newFreeBalance })
        .eq('id', userId)

      // Log the prize transaction
      await logCoinTransaction({
        userId,
        amount: prizeCoins,
        coinType: 'free',
        transactionType: 'wheel_prize',
        source: 'troll_wheel',
        description: `Won ${prizeCoins} coins from Troll Wheel - ${outcome}`,
        metadata: {
          spin_id: spin.id,
          outcome,
          ...metadata
        }
      })
    }

    return { success: true, spinId: spin.id }
  } catch (err) {
    console.error('Error logging wheel spin:', err)
    return { success: false, error: err }
  }
}

/**
 * Get user's wheel spin history
 */
export async function getUserWheelSpins(
  userId: string,
  options?: {
    limit?: number
    offset?: number
  }
) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  let query = supabase
    .from('wheel_spins')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit || 10) - 1
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch wheel spins:', error)
    return { success: false, data: [] }
  }

  return { success: true, data: data || [] }
}

/**
 * Get wheel spin statistics for a user
 */
export async function getUserWheelStats(userId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  const { data, error } = await supabase
    .from('wheel_spins')
    .select('cost_coins, prize_coins, outcome')
    .eq('user_id', userId)

  if (error || !data) {
    return {
      totalSpins: 0,
      totalCost: 0,
      totalPrizes: 0,
      netCoins: 0,
      jackpots: 0,
      outcomes: {}
    }
  }

  const stats = data.reduce(
    (acc, spin) => {
      acc.totalSpins++
      acc.totalCost += spin.cost_coins
      acc.totalPrizes += spin.prize_coins
      
      if (spin.outcome === 'jackpot') {
        acc.jackpots++
      }

      acc.outcomes[spin.outcome] = (acc.outcomes[spin.outcome] || 0) + 1

      return acc
    },
    {
      totalSpins: 0,
      totalCost: 0,
      totalPrizes: 0,
      netCoins: 0,
      jackpots: 0,
      outcomes: {} as Record<string, number>
    }
  )

  stats.netCoins = stats.totalPrizes - stats.totalCost

  return stats
}

/**
 * Get global wheel statistics (admin)
 */
export async function getGlobalWheelStats() {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  const { data, error } = await supabase
    .from('wheel_spins')
    .select('cost_coins, prize_coins, outcome, user_id, created_at')

  if (error || !data) {
    return {
      totalSpins: 0,
      totalRevenue: 0,
      totalPayout: 0,
      netRevenue: 0,
      uniquePlayers: 0,
      outcomeDistribution: {}
    }
  }

  const typedData = data as WheelSpin[]

  const stats = typedData.reduce(
    (acc, spin) => {
      acc.totalSpins++
      acc.totalRevenue += spin.cost_coins
      acc.totalPayout += spin.prize_coins
      acc.outcomeDistribution[spin.outcome] = 
        (acc.outcomeDistribution[spin.outcome] || 0) + 1

      return acc
    },
    {
      totalSpins: 0,
      totalRevenue: 0,
      totalPayout: 0,
      netRevenue: 0,
      uniquePlayers: 0,
      outcomeDistribution: {} as Record<string, number>
    }
  )

  stats.netRevenue = stats.totalRevenue - stats.totalPayout

  // Count unique players
  const uniqueUsers = new Set(typedData.map(s => s.user_id))
  stats.uniquePlayers = uniqueUsers.size

  return stats
}
