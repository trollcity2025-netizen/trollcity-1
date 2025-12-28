// src/lib/coinTransactions.ts
// Centralized coin transaction logging utility

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { trackCoinEarning } from './familyTasks'
import { trackWarActivity } from './familyWars'

const getSupabaseUserId = async (client: SupabaseClient) => {
  const { data } = await client.auth.getSession()
  return data?.session?.user?.id ?? null
}

const safeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'bigint') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatBalanceForRecord = (value: unknown): number | string | null => {
  if (value === undefined || value === null) return null
  if (typeof value === 'bigint') return value.toString()
  return value as number | string
}

export type CoinTransactionType = 
  | 'purchase'          // Buying coins with real money
  | 'gift_sent'         // Sending a gift
  | 'gift_received'     // Receiving a gift
  | 'wheel_win'         // Winning from wheel spin
  | 'wheel_loss'        // Losing from wheel spin
  | 'wheel_spin'        // Cost of spinning wheel
  | 'wheel_prize'       // Prize from wheel spin
  | 'cashout'           // Broadcaster cashing out
  | 'admin_grant'       // Admin manually granting coins
  | 'admin_deduct'      // Admin manually removing coins
  | 'insurance_purchase' // Buying insurance
  | 'entrance_effect'   // Buying entrance effect
  | 'perk_purchase'     // Buying a perk
  | 'refund'            // Refunding a purchase
  | 'reward'            // System reward (daily login, achievement, etc.)

export type CoinType = 'trollmonds' | 'troll_coins'

export interface CoinTransactionMetadata {
  [key: string]: any
  effect_name?: string
  duration?: number
  rarity?: string
  icon?: string
  perk_id?: string
  insurance_id?: string
  gift_id?: string
  package_id?: string
  wheel_outcome?: string
  admin_reason?: string
}

export interface RecordCoinTransactionParams {
  userId: string
  amount: number
  type: CoinTransactionType
  coinType?: CoinType
  sourceType?: string // Legacy field, defaults to type
  sourceId?: string
  description?: string
  metadata?: CoinTransactionMetadata
  balanceAfter?: number | string | null // If not provided, will be calculated
  supabaseClient?: SupabaseClient // Optional supabase client (for backend usage)
}

/**
 * Records a coin transaction to the database
 * This is the ONLY function that should be used to log coin changes
 * 
 * @param params Transaction parameters
 * @returns The created transaction record or null on error
 */
export async function recordCoinTransaction(params: RecordCoinTransactionParams) {
  try {
    const {
      userId,
      amount,
      type,
      coinType,
      sourceType,
      sourceId,
      description,
      metadata,
      balanceAfter,
      supabaseClient
    } = params

    const sb = supabaseClient || supabase
    if (!sb) {
      console.error('recordCoinTransaction: No supabase client available')
      return null
    }

    const sessionUserId = await getSupabaseUserId(sb)
    if (!sessionUserId && !supabaseClient) {
      throw new Error('User not authenticated')
    }

    const targetUserId = sessionUserId ?? userId
    if (!targetUserId) {
      console.error('recordCoinTransaction: userId is required')
      return null
    }

    if (sessionUserId && userId && sessionUserId !== userId) {
      console.debug('recordCoinTransaction session mismatch', {
        authUid: sessionUserId,
        payloadUid: userId
      })
    }

    // Validate required fields
    if (!userId) {
      console.error('recordCoinTransaction: userId is required')
      return null
    }

    if (amount === undefined || amount === null) {
      console.error('recordCoinTransaction: amount is required')
      return null
    }

    const finalBalanceAfter = formatBalanceForRecord(balanceAfter ?? null)
    const coinTypeValue = coinType || 'troll_coins'

    // Insert transaction record
    const insertPayload = {
      user_id: targetUserId,
      amount,
      coin_delta: amount,
      type,
      coin_type: coinTypeValue,
      source_type: sourceType || type,
      source_id: sourceId || null,
      description: description || null,
      balance_after: finalBalanceAfter,
      metadata: metadata || null,
      created_at: new Date().toISOString()
    }

    const { data, error } = await sb
      .from('coin_transactions')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      const message = error.message || ''
      const isCoinTypeCheck =
        error.code === '23514' &&
        message.toLowerCase().includes('coin_transactions_coin_type_check')

      if (isCoinTypeCheck) {
        const legacyCoinType = coinType === 'troll_coins' ? 'paid' : 'free'
        const { data: retryData, error: retryError } = await sb
          .from('coin_transactions')
          .insert({ ...insertPayload, coin_type: legacyCoinType })
          .select()
          .single()

        if (retryError) {
          console.error('recordCoinTransaction error:', retryError)
          return null
        }

        return retryData
      }

      console.error('recordCoinTransaction error:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('recordCoinTransaction exception:', err)
    return null
  }
}

/**
 * Deducts coins from user balance and logs transaction
 * Use this for purchases (insurance, effects, perks, etc.)
 * 
 * @returns { success: boolean, newBalance: number, transaction: object | null }
 */
export async function deductCoins(params: {
  userId: string
  amount: number
  type: CoinTransactionType
  coinType?: CoinType
  description?: string
  metadata?: CoinTransactionMetadata
  supabaseClient?: SupabaseClient
  balanceAfter?: number | string | null
}) {
  const { userId, amount, type, coinType = 'troll_coins', description, metadata, supabaseClient, balanceAfter } = params

  const sb = supabaseClient || supabase
  if (!sb) {
    console.error('deductCoins: No supabase client available')
    return { success: false, newBalance: 0, transaction: null, error: 'No supabase client' }
  }

  try {
    const sessionUserId = await getSupabaseUserId(sb)

    if (!sessionUserId && !supabaseClient) {
      throw new Error('User not authenticated')
    }

    if (sessionUserId && sessionUserId !== userId) {
      console.debug('deductCoins session mismatch', { authUid: sessionUserId, payloadUid: userId })
    }

    const normalizedAmount = Math.max(0, Math.round(amount))
    if (normalizedAmount <= 0) {
      return {
        success: false,
        newBalance: null,
        transaction: null,
        error: 'Invalid amount'
      }
    }

    let newBalance: number | null = null
    let rpcError: any = null
    let rpcBalanceResult: unknown = null
    const amountParam = normalizedAmount.toString()

    if (coinType === 'trollmonds') {
      const { data: rpcData, error } = await sb.rpc('spend_trollmonds', {
        p_user_id: userId,
        p_amount: amountParam,
        p_reason: description || type
      })

      rpcError = error
      if (!error) {
        if (rpcData && typeof rpcData === 'object' && 'remaining' in rpcData) {
          rpcBalanceResult = (rpcData as any).remaining
        } else {
          rpcBalanceResult = rpcData
        }
      }
    } else {
      const { data: rpcBalance, error: deductError } = await sb.rpc('deduct_user_troll_coins', {
        p_user_id: userId,
        p_amount: amountParam
      })

      rpcError = deductError
      rpcBalanceResult = rpcBalance
    }

    if (!rpcError) {
      newBalance = safeNumber(rpcBalanceResult)
    }

    if (rpcError) {
      console.error('deductCoins: RPC error', rpcError)
      return { success: false, newBalance: null, transaction: null, error: rpcError.message || 'Failed to deduct coins' }
    }

    const balanceAfterForRecord = formatBalanceForRecord(
      balanceAfter ?? rpcBalanceResult ?? null,
    )

    const transaction = await recordCoinTransaction({
      userId,
      amount: -normalizedAmount,
      type,
      coinType,
      description,
      metadata,
      balanceAfter: balanceAfterForRecord,
      supabaseClient: sb
    })

    return {
      success: true,
      newBalance,
      transaction,
      error: null
    }
  } catch (err: any) {
    console.error('deductCoins exception:', err)
    return {
      success: false,
      newBalance: null,
      transaction: null,
      error: err.message || 'Unknown error'
    }
  }
}

/**
 * Adds coins to user balance and logs transaction
 * Use this for rewards, refunds, admin grants, etc.
 */
export async function addCoins(params: {
  userId: string
  amount: number
  type: CoinTransactionType
  coinType?: CoinType
  description?: string
  metadata?: CoinTransactionMetadata
  supabaseClient?: SupabaseClient // Optional supabase client (for backend usage)
}) {
  const { userId, amount, type, coinType = 'troll_coins', description, metadata, supabaseClient } = params
  const finalCoinType = coinType || 'troll_coins'

  const sb = supabaseClient || supabase
  if (!sb) {
    console.error('addCoins: No supabase client available')
    return { success: false, newBalance: 0, transaction: null, error: 'No supabase client' }
  }

  try {
    const { data: profile, error: profileError } = await sb
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('addCoins: Failed to get profile', profileError)
      return { success: false, newBalance: 0, transaction: null, error: 'Profile not found' }
    }

    const currentBalance = profile.troll_coins ?? 0

    const newBalance = currentBalance + amount

    // Update balance
    const { error: updateError } = await sb
      .from('user_profiles')
      .update({ troll_coins: newBalance })
      .eq('id', userId)

    if (updateError) {
      console.error('addCoins: Failed to update balance', updateError)
      return { success: false, newBalance: currentBalance, transaction: null, error: 'Update failed' }
    }

    // Record transaction
    const transaction = await recordCoinTransaction({
      userId,
      amount, // Positive for additions
      type,
      coinType: finalCoinType,
      description,
      metadata,
      balanceAfter: newBalance,
      supabaseClient: sb
    })

    // Family coin earning hook: Allocate 10% of troll_coins to family stats
    if (finalCoinType === 'troll_coins' && amount > 0) {
      try {
        // Check if user is in a family
        const { data: familyMember } = await sb
          .from('family_members')
          .select('family_id')
          .eq('user_id', userId)
          .single()

        if (familyMember?.family_id) {
          const familyBonus = Math.floor(amount * 0.10) // 10% of earned troll_coins
          if (familyBonus > 0) {
            // Use RPC function to atomically update family stats
            const { data: _familyResult, error: familyError } = await sb.rpc('increment_family_stats', {
              p_family_id: familyMember.family_id,
              p_coin_bonus: familyBonus,
              p_xp_bonus: 0
            })

            if (familyError) {
              console.warn('Failed to update family stats for coin earning:', familyError)
            } else {
              console.log(`Allocated ${familyBonus} family coins to family ${familyMember.family_id}`)
            }
          }

          // Track coin earning for family tasks
          try {
            await trackCoinEarning(userId, amount)
          } catch (taskErr) {
            console.warn('Failed to track coin earning for tasks:', taskErr)
          }

          // Track coin earning for active wars
          try {
            await trackWarActivity(userId, 'coin_earned', amount)
          } catch (warErr) {
            console.warn('Failed to track coin earning for wars:', warErr)
          }
        }
      } catch (familyErr) {
        console.warn('Family coin allocation failed:', familyErr)
        // Don't fail the main transaction for family allocation errors
      }
    }

    return {
      success: true,
      newBalance,
      transaction,
      error: null
    }
  } catch (err: any) {
    console.error('addCoins exception:', err)
    return {
      success: false,
      newBalance: 0,
      transaction: null,
      error: err.message || 'Unknown error'
    }
  }
}

/**
 * Check if user has active insurance of a specific type
 */
export async function hasActiveInsurance(
  userId: string,
  protectionType: 'bankrupt' | 'kick' | 'full',
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const sb = supabaseClient || supabase
  if (!sb) {
    console.error('hasActiveInsurance: No supabase client available')
    return false
  }
  
  try {
    const { data, error } = await sb
      .from('user_insurances')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .or(`protection_type.eq.${protectionType},protection_type.eq.full`)
      .limit(1)

    if (error) {
      console.error('hasActiveInsurance error:', error)
      return false
    }

    return (data?.length || 0) > 0
  } catch (err) {
    console.error('hasActiveInsurance exception:', err)
    return false
  }
}

/**
 * Increment insurance trigger count
 */
export async function triggerInsurance(insuranceId: string, supabaseClient?: SupabaseClient) {
  const sb = supabaseClient || supabase
  if (!sb) {
    console.error('triggerInsurance: No supabase client available')
    return
  }
  
  try {
    await sb.rpc('increment_insurance_trigger', { insurance_id: insuranceId })
  } catch (err) {
    console.error('triggerInsurance error:', err)
  }
}
