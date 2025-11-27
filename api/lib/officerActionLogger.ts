import { createClient } from '@supabase/supabase-js'
import { logCoinTransaction } from './coinTransactionLogger'

/**
 * Officer Actions & Earnings Tracker
 * Handles moderation action logging and commission calculations
 */

interface LogOfficerActionParams {
  officerId: string
  targetUserId: string
  actionType: 'kick' | 'ban' | 'mute'
  reason?: string
  relatedStreamId?: string
  feeCoins?: number
}

interface OfficerActionResult {
  success: boolean
  actionId?: string
  earningId?: string
  error?: any
}

/**
 * Log a moderation action and calculate officer commission
 */
export async function logOfficerAction(
  params: LogOfficerActionParams
): Promise<OfficerActionResult> {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  const {
    officerId,
    targetUserId,
    actionType,
    reason,
    relatedStreamId,
    feeCoins = 0
  } = params

  try {
    // 1. Log the officer action
    const { data: action, error: actionError } = await supabase
      .from('officer_actions')
      .insert({
        officer_id: officerId,
        target_user_id: targetUserId,
        action_type: actionType,
        reason: reason || null,
        related_stream_id: relatedStreamId || null,
        fee_coins: feeCoins
      })
      .select()
      .single()

    if (actionError) {
      console.error('Failed to log officer action:', actionError)
      return { success: false, error: actionError }
    }

    console.log('Officer action logged:', {
      id: action.id,
      officer: officerId,
      target: targetUserId,
      type: actionType,
      fee: feeCoins
    })

    // 2. If there's a fee, charge the target user
    if (feeCoins > 0) {
      // Deduct coins from target user (prefer paid, then free)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance, free_coin_balance')
        .eq('id', targetUserId)
        .single()

      if (profile) {
        const paidBalance = profile.paid_coin_balance || 0
        const freeBalance = profile.free_coin_balance || 0

        let paidDebit = 0
        let freeDebit = 0

        if (paidBalance >= feeCoins) {
          // Deduct entirely from paid
          paidDebit = feeCoins
          await supabase
            .from('user_profiles')
            .update({ paid_coin_balance: paidBalance - feeCoins })
            .eq('id', targetUserId)
        } else {
          // Deduct from paid, then free
          paidDebit = paidBalance
          freeDebit = feeCoins - paidBalance

          await supabase
            .from('user_profiles')
            .update({
              paid_coin_balance: 0,
              free_coin_balance: Math.max(0, freeBalance - freeDebit)
            })
            .eq('id', targetUserId)
        }

        // Log the fee transaction for target user
        await logCoinTransaction({
          userId: targetUserId,
          amount: -feeCoins,
          coinType: paidDebit > 0 ? 'paid' : 'free',
          transactionType: actionType === 'kick' ? 'kick_fee' : 'ban_fee',
          source: 'moderation',
          description: `${actionType} fee - ${reason || 'No reason provided'}`,
          metadata: {
            action_id: action.id,
            officer_id: officerId,
            action_type: actionType,
            stream_id: relatedStreamId,
            paid_debit: paidDebit,
            free_debit: freeDebit
          }
        })
      }

      // 3. Calculate officer commission (10% of fee)
      const commissionCoins = Math.floor(feeCoins * 0.1)
      const usdValue = Number((commissionCoins * 0.01).toFixed(2)) // Assuming 1 coin ≈ $0.01

      // Log the earning
      const { data: earning, error: earningError } = await supabase
        .from('officer_earnings')
        .insert({
          officer_id: officerId,
          action_id: action.id,
          commission_coins: commissionCoins,
          usd_value: usdValue
        })
        .select()
        .single()

      if (earningError) {
        console.error('Failed to log officer earning:', earningError)
        // Don't fail the action if earning log fails
      } else {
        console.log('Officer commission logged:', {
          earning_id: earning.id,
          officer: officerId,
          coins: commissionCoins,
          usd: usdValue
        })

        // Credit officer with commission coins
        const { data: officerProfile } = await supabase
          .from('user_profiles')
          .select('paid_coin_balance')
          .eq('id', officerId)
          .single()

        if (officerProfile) {
          const newBalance = (officerProfile.paid_coin_balance || 0) + commissionCoins

          await supabase
            .from('user_profiles')
            .update({ paid_coin_balance: newBalance })
            .eq('id', officerId)

          // Log commission transaction for officer
          await logCoinTransaction({
            userId: officerId,
            amount: commissionCoins,
            coinType: 'paid',
            transactionType: 'bonus',
            source: 'moderation_commission',
            description: `Officer commission - ${actionType} fee`,
            metadata: {
              action_id: action.id,
              earning_id: earning.id,
              target_user_id: targetUserId,
              original_fee: feeCoins,
              commission_rate: 0.1
            }
          })
        }

        return {
          success: true,
          actionId: action.id,
          earningId: earning.id
        }
      }
    }

    return { success: true, actionId: action.id }
  } catch (err) {
    console.error('Error logging officer action:', err)
    return { success: false, error: err }
  }
}

/**
 * Get officer's action history
 */
export async function getOfficerActions(
  officerId: string,
  options?: {
    limit?: number
    actionType?: 'kick' | 'ban' | 'mute'
  }
) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  let query = supabase
    .from('officer_actions')
    .select('*')
    .eq('officer_id', officerId)
    .order('created_at', { ascending: false })

  if (options?.actionType) {
    query = query.eq('action_type', options.actionType)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch officer actions:', error)
    return { success: false, error, data: [] }
  }

  return { success: true, data: data || [] }
}

/**
 * Get officer's earnings summary
 */
export async function getOfficerEarnings(officerId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  const { data, error } = await supabase
    .from('officer_earnings')
    .select('*')
    .eq('officer_id', officerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch officer earnings:', error)
    return {
      success: false,
      totalCoins: 0,
      totalUsd: 0,
      earnings: []
    }
  }

  const totalCoins = data?.reduce((sum, e) => sum + e.commission_coins, 0) || 0
  const totalUsd = data?.reduce((sum, e) => sum + Number(e.usd_value), 0) || 0

  return {
    success: true,
    totalCoins,
    totalUsd: Number(totalUsd.toFixed(2)),
    earnings: data || []
  }
}

/**
 * Get actions taken against a specific user
 */
export async function getUserModerationHistory(userId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  const { data, error } = await supabase
    .from('officer_actions')
    .select('*, officer:officer_id(id, username, avatar_url)')
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch user moderation history:', error)
    return { success: false, data: [] }
  }

  return { success: true, data: data || [] }
}
