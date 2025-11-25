import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'

const router = Router()

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const COIN_TO_USD_RATE = Number(process.env.COIN_TO_USD_RATE || 160)

const STATUS_PENDING = 'pending'
const STATUS_COMPLETED = 'completed'
const PROVIDER_SQUARE = 'square'
const PROVIDER_SQUARE_PAYOUT = 'square_payout'

router.post('/request', async (req, res) => {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { userId, coinsToRedeem, provider } = req.body || {}

    if (!userId || !coinsToRedeem || String(provider).toLowerCase() !== PROVIDER_SQUARE) {
      return res.status(400).json({ error: 'Invalid request' })
    }

    // Fetch user profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('user_profiles')
      .select('id, paid_coin_balance')
      .eq('id', userId)
      .single()

    if (profileErr || !profile) throw new Error('User profile not found')

    // Check coin balance
    const balance = Number(profile.paid_coin_balance || 0)
    if (balance < coinsToRedeem) {
      return res.status(400).json({ error: 'Insufficient coin balance' })
    }

    // Check payout method
    const { data: payoutMethod, error: payoutMethodErr } = await supabaseAdmin
      .from('user_payment_methods')
      .select('id, provider')
      .eq('user_id', userId)
      .eq('provider', PROVIDER_SQUARE_PAYOUT)
      .eq('is_default', true)
      .maybeSingle()

    if (payoutMethodErr) throw payoutMethodErr
    if (!payoutMethod) {
      return res.status(400).json({ error: 'No default payout method configured' })
    }

    const usdAmount = Math.round((coinsToRedeem / COIN_TO_USD_RATE) * 100) / 100
    const now = new Date().toISOString()

    // Deduct coins
    const { error: balErr } = await supabaseAdmin
      .from('user_profiles')
      .update({ paid_coin_balance: balance - coinsToRedeem, updated_at: now })
      .eq('id', userId)

    if (balErr) throw balErr

    // Create payout record
    const { data: payout, error: payoutErr } = await supabaseAdmin
      .from('payouts')
      .insert([{
        user_id: userId,
        payout_amount: usdAmount,
        provider: PROVIDER_SQUARE,
        status: STATUS_PENDING,
        created_at: now,
        updated_at: now
      }])
      .select('*')

    if (payoutErr || !payout) throw payoutErr

    // Record transaction
    const { error: txErr } = await supabaseAdmin
      .from('coin_transactions')
      .insert([{
        user_id: userId,
        amount: -coinsToRedeem,
        type: 'payout',
        description: `Bank payout via Square: $${usdAmount}`,
        metadata: { payout_id: payout[0]?.id, provider: PROVIDER_SQUARE },
        created_at: now
      }])

    if (txErr) throw txErr

    res.json({ success: true, payout: payout[0] })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Payout request failed' })
  }
})

router.post('/complete', async (req, res) => {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { payoutId } = req.body || {}
    if (!payoutId) return res.status(400).json({ error: 'Missing payoutId' })

    const { data: payout, error: findErr } = await supabaseAdmin
      .from('payouts')
      .select('*')
      .eq('id', payoutId)
      .single()
    if (findErr) throw findErr

    if (!payout || payout.status !== STATUS_PENDING) {
      return res.status(400).json({ error: 'Payout not pending' })
    }

    const squarePayoutId = `sq_${Math.random().toString(36).slice(2)}_${Date.now()}`
    const now = new Date().toISOString()

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('payouts')
      .update({
        status: STATUS_COMPLETED,
        square_payout_id: squarePayoutId,
        updated_at: now
      })
      .eq('id', payoutId)
      .select('*')
      .single()

    if (updErr) throw updErr

    res.json({ success: true, payout: updated })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Payout complete failed' })
  }
})

export default router
