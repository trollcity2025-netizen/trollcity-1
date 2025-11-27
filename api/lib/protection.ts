// api/lib/protection.ts
import { createClient } from '@supabase/supabase-js'
import { getRevenueSettings } from './revenue.js'

const supabaseUrl = process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
export const adminClient = createClient(supabaseUrl, serviceKey)

export async function addRiskEvent(input: {
  user_id: string
  event_type: string
  severity: number
  details?: string
}) {
  const { data, error } = await adminClient
    .from('risk_events')
    .insert({
      user_id: input.user_id,
      event_type: input.event_type,
      severity: input.severity,
      details: input.details ?? null
    })
    .select()
    .single()

  if (error) throw error

  const { data: profile, error: profErr } = await adminClient
    .from('user_risk_profile')
    .upsert(
      {
        user_id: input.user_id,
        risk_score: input.severity,
        last_event_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (profErr) throw profErr

  const newScore = (profile?.risk_score ?? 0) + input.severity

  const { error: updErr } = await adminClient
    .from('user_risk_profile')
    .update({ risk_score: newScore, last_event_at: new Date().toISOString() })
    .eq('user_id', input.user_id)

  if (updErr) throw updErr

  // Auto-freeze threshold
  if (newScore >= 20) {
    await adminClient
      .from('user_risk_profile')
      .update({
        is_frozen: true,
        freeze_reason: 'Automatic freeze: high risk score'
      })
      .eq('user_id', input.user_id)
  }

  return { data, newScore }
}

export async function isUserFrozen(userId: string) {
  const { data, error } = await adminClient
    .from('user_risk_profile')
    .select('is_frozen')
    .eq('user_id', userId)
    .single()

  if (error) return false
  return !!data?.is_frozen
}

export function requireNotFrozen() {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const frozen = await isUserFrozen(userId)
    if (frozen) {
      return res.status(423).json({
        error: 'Account temporarily frozen for review. Contact support.'
      })
    }
    next()
  }
}

// Anti self-gifting check (call in gift route)
export async function validateGiftNotAbusive(input: {
  sender_id: string
  receiver_id: string
  coins: number
}) {
  if (input.sender_id === input.receiver_id) {
    await addRiskEvent({
      user_id: input.sender_id,
      event_type: 'self_gift_attempt',
      severity: 5,
      details: 'Tried to gift coins to self'
    })
    throw new Error('You cannot gift coins to yourself.')
  }

  // TODO: also check if both users share same payout details, etc. later
}

// Cashout eligibility
export async function evaluateCashoutEligibility(input: {
  user_id: string
  usd_value: number
}) {
  const settings = await getRevenueSettings()

  if (input.usd_value < settings.min_cashout_usd) {
    return {
      eligible: false,
      reason: `Minimum cashout is $${settings.min_cashout_usd.toFixed(2)}`
    }
  }

  // example: sum broadcaster_earnings stream_hours from another table if you have it
  const { data: profile, error } = await adminClient
    .from('user_profiles')
    .select('total_stream_hours, tax_form_status')
    .eq('id', input.user_id)
    .single()

  if (error) {
    return { eligible: false, reason: 'Profile missing for eligibility check' }
  }

  if (
    (profile?.total_stream_hours ?? 0) <
    settings.min_stream_hours_for_cashout
  ) {
    return {
      eligible: false,
      reason: `Need at least ${settings.min_stream_hours_for_cashout} stream hours`
    }
  }

  if (settings.tax_form_required && profile?.tax_form_status !== 'on_file') {
    return {
      eligible: false,
      reason: 'Tax form required before cashout'
    }
  }

  return { eligible: true, reason: null }
}
