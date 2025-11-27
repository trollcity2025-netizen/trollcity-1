import { createClient } from '@supabase/supabase-js'

/**
 * Master coin transaction logger
 * Records all coin movements in the system for audit trail
 * 
 * Uses existing coin_transactions table with these columns:
 * - id, user_id, amount, type, coin_type, source, description, metadata,
 *   platform_profit, liability, balance_after, created_at
 */

interface LogCoinTransactionParams {
  userId: string
  amount: number // positive for credit, negative for debit
  coinType: 'paid' | 'free' // paid = purchased coins, free = promotional
  transactionType: 
    | 'store_purchase'   // user buys coins with $ via Square
    | 'gift_sent'        // user spends coins to send gift
    | 'gift_received'    // user receives coins/diamonds from gift
    | 'wheel_spin'       // coins spent on wheel spin
    | 'wheel_prize'      // coins won from wheel
    | 'kick_fee'         // user charged for being kicked
    | 'ban_fee'          // user charged for ban appeal/unban
    | 'entrance_effect'  // entrance effect purchased
    | 'insurance'        // insurance coins purchased
    | 'adjustment'       // admin manual adjustment
    | 'cashout'          // coins removed when paid out in $
    | 'refund'           // coins refunded from failed transaction
    | 'bonus'            // promotional/bonus coins
    | 'initial_balance'  // starting coins for new users
  source?: string       // payment provider or system source
  description?: string
  metadata?: Record<string, any>
  platformProfit?: number  // USD profit (after fees) for purchases
  liability?: number       // USD liability (potential cashout value)
  balanceAfter?: number
}

export async function logCoinTransaction(params: LogCoinTransactionParams) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  const {
    userId,
    amount,
    coinType,
    transactionType,
    source,
    description,
    metadata = {},
    platformProfit = 0,
    liability = 0,
    balanceAfter
  } = params

  try {
    // If balanceAfter not provided, fetch current balance
    let finalBalance = balanceAfter
    if (finalBalance === undefined) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance, free_coin_balance')
        .eq('id', userId)
        .single()

      if (profile) {
        finalBalance = (profile.paid_coin_balance || 0) + (profile.free_coin_balance || 0)
      }
    }

    const { data, error } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: userId,
        amount,
        type: transactionType,
        coin_type: coinType,
        source: source || 'system',
        description: description || `${transactionType} transaction`,
        metadata,
        platform_profit: platformProfit,
        liability: liability,
        balance_after: finalBalance
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to log coin transaction:', error)
      return { success: false, error }
    }

    console.log('Coin transaction logged:', {
      id: data.id,
      userId,
      amount,
      type: transactionType,
      balanceAfter: finalBalance
    })

    return { success: true, data }
  } catch (err) {
    console.error('Error logging coin transaction:', err)
    return { success: false, error: err }
  }
}

/**
 * Get user's transaction history
 */
export async function getUserTransactionHistory(
  userId: string,
  options?: {
    limit?: number
    offset?: number
    transactionType?: string
  }
) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  let query = supabase
    .from('coin_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (options?.transactionType) {
    query = query.eq('type', options.transactionType)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch transaction history:', error)
    return { success: false, error, data: [] }
  }

  return { success: true, data: data || [] }
}

/**
 * Get transaction statistics for a user
 */
export async function getUserTransactionStats(userId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  const { data, error } = await supabase
    .from('coin_transactions')
    .select('amount, coin_type, type')
    .eq('user_id', userId)

  if (error || !data) {
    return {
      totalSpent: 0,
      totalEarned: 0,
      totalPurchased: 0,
      totalFree: 0,
      transactionCount: 0
    }
  }

  const stats = data.reduce(
    (acc, tx) => {
      acc.transactionCount++
      
      if (tx.amount > 0) {
        acc.totalEarned += tx.amount
        if (tx.coin_type === 'paid') {
          acc.totalPurchased += tx.amount
        } else {
          acc.totalFree += tx.amount
        }
      } else {
        acc.totalSpent += Math.abs(tx.amount)
      }

      return acc
    },
    {
      totalSpent: 0,
      totalEarned: 0,
      totalPurchased: 0,
      totalFree: 0,
      transactionCount: 0
    }
  )

  return stats
}
