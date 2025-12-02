// src/lib/economy.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
export const adminClient = createClient(supabaseUrl, supabaseServiceKey)

const COIN_TO_USD = 0.0001 // example: 10,000 coins = $1.00 (adjust to your real rate)

export async function recordCoinTransaction(input: {
  user_id: string
  amount: number
  is_paid: boolean
  source_type: string
  source_id?: string
  metadata?: any
}) {
  const { data, error } = await adminClient
    .from('coin_transactions')
    .insert({
      user_id: input.user_id,
      amount: input.amount,
      coin_type: input.is_paid ? 'paid' : 'free',
      type: input.source_type,
      source: input.metadata?.source || 'system',
      description: input.metadata?.description || `${input.source_type} transaction`,
      metadata: input.metadata ?? {},
      platform_profit: input.metadata?.platform_profit ?? 0,
      liability: input.metadata?.liability ?? 0,
      balance_after: input.metadata?.balance_after
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export function coinsToUsd(coins: number) {
  return Number(((coins * COIN_TO_USD)).toFixed(2))
}

export async function recordBroadcasterEarning(input: {
  broadcaster_id: string
  coins_earned: number
  source_type: string
  source_id?: string
}) {
  const usd_value = coinsToUsd(input.coins_earned)
  const { data, error } = await adminClient
    .from('broadcaster_earnings')
    .insert({
      broadcaster_id: input.broadcaster_id,
      coins_earned: input.coins_earned,
      usd_value,
      source_type: input.source_type,
      source_id: input.source_id ?? null
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function recordOfficerActionWithFee(input: {
  officer_id: string
  target_user_id: string
  action_type: 'kick' | 'ban'
  reason?: string
  related_stream_id?: string
  fee_coins: number
  officer_commission_pct: number // e.g. 0.3 = 30%
}) {
  // 1) charge user (negative coins)
  const feeTx = await recordCoinTransaction({
    user_id: input.target_user_id,
    amount: -Math.abs(input.fee_coins),
    is_paid: true,
    source_type: input.action_type === 'kick' ? 'kick_fee' : 'ban_fee',
    metadata: { 
      officer_id: input.officer_id,
      description: `${input.action_type} fee - ${input.reason || 'No reason provided'}`,
      source: 'moderation'
    }
  })

  // 2) log officer action
  const { data: action, error: actionError } = await adminClient
    .from('officer_actions')
    .insert({
      officer_id: input.officer_id,
      target_user_id: input.target_user_id,
      action_type: input.action_type,
      reason: input.reason ?? null,
      related_stream_id: input.related_stream_id ?? null,
      fee_coins: input.fee_coins
    })
    .select()
    .single()

  if (actionError) throw actionError

  // Update officer activity (for shift tracking)
  try {
    const { updateOfficerActivity } = await import('./officerActivity')
    await updateOfficerActivity(input.officer_id)
  } catch (err) {
    console.warn('[Economy] Failed to update officer activity:', err)
    // Don't throw - activity update failure shouldn't block the action
  }

  // 3) pay officer commission
  const commissionCoins = Math.round(input.fee_coins * input.officer_commission_pct)
  const usd_value = coinsToUsd(commissionCoins)

  const { data: offEarn, error: offErr } = await adminClient
    .from('officer_earnings')
    .insert({
      officer_id: input.officer_id,
      action_id: action.id,
      commission_coins: commissionCoins,
      usd_value
    })
    .select()
    .single()

  if (offErr) throw offErr

  // 4) credit officer with commission coins
  await recordCoinTransaction({
    user_id: input.officer_id,
    amount: commissionCoins,
    is_paid: true,
    source_type: 'bonus',
    metadata: {
      description: `Officer commission - ${input.action_type} fee`,
      source: 'moderation_commission',
      action_id: action.id,
      earning_id: offEarn.id,
      target_user_id: input.target_user_id,
      original_fee: input.fee_coins,
      commission_rate: input.officer_commission_pct
    }
  })

  return { feeTx, action, offEarn }
}
