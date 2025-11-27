// api/lib/revenue.ts
import { createClient } from '@supabase/supabase-js'
import { adminClient, coinsToUsd, recordBroadcasterEarning } from './economy.js'

const supabaseUrl = process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
export const supa = createClient(supabaseUrl, serviceKey)

export interface RevenueSettings {
  id: number
  platform_cut_pct: number
  broadcaster_cut_pct: number
  officer_cut_pct: number
  min_cashout_usd: number
  min_stream_hours_for_cashout: number
  cashout_hold_days: number
  tax_form_required: boolean
}

export async function getRevenueSettings(): Promise<RevenueSettings> {
  const { data, error } = await adminClient
    .from('revenue_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error || !data) {
    // defaults if table empty for some reason
    return {
      id: 1,
      platform_cut_pct: 40,
      broadcaster_cut_pct: 60,
      officer_cut_pct: 30,
      min_cashout_usd: 21,
      min_stream_hours_for_cashout: 5,
      cashout_hold_days: 0,
      tax_form_required: true
    }
  }
  return data as RevenueSettings
}

// Call this when a paid gift hits a broadcaster
export async function handlePaidGiftRevenue(input: {
  sender_id: string
  broadcaster_id: string
  coins: number
  gift_id?: string
}) {
  const settings = await getRevenueSettings()

  const broadcasterCoins = Math.round(
    input.coins * (settings.broadcaster_cut_pct / 100)
  )
  const platformCoins = input.coins - broadcasterCoins

  // broadcaster earnings (coins + usd)
  const earning = await recordBroadcasterEarning({
    broadcaster_id: input.broadcaster_id,
    coins_earned: broadcasterCoins,
    source_type: 'gift_received',
    source_id: input.gift_id
  })

  // platform revenue snapshot (optional: new table, or just store as metadata on coin_transactions)
  const usdValue = coinsToUsd(platformCoins)
  const { error } = await adminClient
    .from('coin_transactions')
    .insert({
      user_id: input.broadcaster_id, // or null if you want "platform" as pseudo-user
      amount: 0,
      coin_type: 'paid',
      type: 'adjustment',
      source: 'platform_revenue',
      description: 'Platform revenue from gift',
      metadata: {
        kind: 'platform_revenue',
        from_gift_coins: platformCoins,
        usd_value: usdValue,
        gift_id: input.gift_id
      },
      platform_profit: 0,
      liability: 0
    })

  if (error) throw error

  return { earning, platformCoins, usdValue }
}
