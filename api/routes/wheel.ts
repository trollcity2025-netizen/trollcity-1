import { Router, type Request, type Response, type NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null

const router = Router()

type AuthedRequest = Request & { userId?: string }

const requireUserAuth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' })
    }
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })
    const { data, error } = await supabase!.auth.getUser(token)
    if (error || !data.user) return res.status(401).json({ error: 'Invalid token' })
    req.userId = data.user.id
    next()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: 'Auth verification failed', details: msg })
  }
}

router.post('/deduct', requireUserAuth, async (req: AuthedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' })
    }
    const { userId: authedUserId } = req
    const { userId, amount } = (req.body || {}) as { userId?: string; amount?: number }
    const amt = Number(amount || 0)
    if (!userId || !authedUserId || authedUserId !== userId) return res.status(403).json({ error: 'Forbidden' })
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' })

    const { data: profile, error: selErr } = await supabase!
      .from('user_profiles')
      .select('id, free_coin_balance')
      .eq('id', userId)
      .single()
    if (selErr || !profile) return res.status(404).json({ error: 'User not found' })

    const freeBal = Number(profile.free_coin_balance || 0)
    if (freeBal < amt) return res.status(400).json({ error: 'Insufficient free coin balance' })

    const { data: updated, error: updErr } = await supabase!
      .from('user_profiles')
      .update({ free_coin_balance: freeBal - amt, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, free_coin_balance')
      .single()
    if (updErr) throw updErr

    return res.json({ success: true, profile: updated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg || 'Deduct failed' })
  }
})

router.post('/award', requireUserAuth, async (req: AuthedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' })
    }
    const { userId: authedUserId } = req
    const { userId, awardType, value } = (req.body || {}) as { userId?: string; awardType?: string; value?: number }
    if (!userId || !authedUserId || authedUserId !== userId) return res.status(403).json({ error: 'Forbidden' })

    const now = new Date().toISOString()

    if (awardType === 'coins') {
      const add = Number(value || 0)
      if (!Number.isFinite(add) || add <= 0) return res.status(400).json({ error: 'Invalid coin value' })
      const { data: profile, error: selErr } = await supabase!
        .from('user_profiles')
        .select('id, free_coin_balance')
        .eq('id', userId)
        .single()
      if (selErr || !profile) return res.status(404).json({ error: 'User not found' })
      const freeBal = Number(profile.free_coin_balance || 0)
      const { data: updated, error: updErr } = await supabase!
        .from('user_profiles')
        .update({ free_coin_balance: freeBal + add, updated_at: now })
        .eq('id', userId)
        .select('*')
        .single()
      if (updErr) throw updErr
      return res.json({ success: true, profile: updated })
    }

    if (awardType === 'insurance') {
      const { data: updated, error: updErr } = await supabase!
        .from('user_profiles')
        .update({ has_insurance: true, updated_at: now })
        .eq('id', userId)
        .select('*')
        .single()
      if (updErr) throw updErr
      return res.json({ success: true, profile: updated })
    }

    if (awardType === 'multiplier') {
      const mult = Number(value || 0)
      if (!Number.isFinite(mult) || mult <= 0) return res.status(400).json({ error: 'Invalid multiplier value' })
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      const { data: updated, error: updErr } = await supabase!
        .from('user_profiles')
        .update({ multiplier_active: true, multiplier_value: mult, multiplier_expires: expires, updated_at: now })
        .eq('id', userId)
        .select('*')
        .single()
      if (updErr) throw updErr
      return res.json({ success: true, profile: updated })
    }

    if (awardType === 'bankrupt') {
      const { data: updated, error: updErr } = await supabase!
        .from('user_profiles')
        .update({ free_coin_balance: 0, updated_at: now })
        .eq('id', userId)
        .select('*')
        .single()
      if (updErr) throw updErr
      return res.json({ success: true, profile: updated })
    }

    if (awardType === 'jackpot') {
      const { data: updated, error: updErr } = await supabase!
        .from('user_profiles')
        .update({ badge: 'crown', updated_at: now })
        .eq('id', userId)
        .select('*')
        .single()
      if (updErr) throw updErr
      return res.json({ success: true, profile: updated })
    }

    return res.status(400).json({ error: 'Unknown awardType' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg || 'Award failed' })
  }
})

router.post('/spins/status', requireUserAuth, async (req: AuthedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' })
    }
    const { userId: authedUserId } = req
    const { userId } = (req.body || {}) as { userId?: string }
    if (!userId || !authedUserId || authedUserId !== userId) return res.status(403).json({ error: 'Forbidden' })

    const today = new Date().toISOString().split('T')[0]

    const { data: profile } = await supabase!
      .from('user_profiles')
      .select('id, role')
      .eq('id', userId)
      .single()
    const dailyLimit = (profile?.role === 'troll_officer') ? 15 : 10

    const { data } = await supabase!
      .from('wheel_spins')
      .select('id, spin_count')
      .eq('user_id', userId)
      .eq('spin_date', today)
      .maybeSingle()

    const count = Number(data?.spin_count || 0)
    const left = Math.max(0, dailyLimit - count)
    return res.json({ success: true, spin_count: count, daily_limit: dailyLimit, spins_left: left })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg || 'Spin status failed' })
  }
})

router.post('/spins/register', requireUserAuth, async (req: AuthedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' })
    }
    const { userId: authedUserId } = req
    const { userId } = (req.body || {}) as { userId?: string }
    if (!userId || !authedUserId || authedUserId !== userId) return res.status(403).json({ error: 'Forbidden' })

    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase!
      .from('wheel_spins')
      .select('id, spin_count')
      .eq('user_id', userId)
      .eq('spin_date', today)
      .maybeSingle()

    if (!data) {
      const { data: inserted, error: insErr } = await supabase!
        .from('wheel_spins')
        .insert({ user_id: userId, spin_date: today, spin_count: 1 })
        .select('id, spin_count')
        .single()
      if (insErr) throw insErr
      return res.json({ success: true, spin_count: Number(inserted?.spin_count || 1) })
    } else {
      const { data: updated, error: updErr } = await supabase!
        .from('wheel_spins')
        .update({ spin_count: Number(data.spin_count || 0) + 1 })
        .eq('id', data.id)
        .select('id, spin_count')
        .single()
      if (updErr) throw updErr
      return res.json({ success: true, spin_count: Number(updated?.spin_count || 0) })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg || 'Register spin failed' })
  }
})

export default router

// Full spin endpoint: deduct cost, pick prize, apply award, register spin
router.post('/spin', requireUserAuth, async (req: AuthedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' })
    }
    const { userId: authedUserId } = req
    const { userId, spinCost, prizes } = (req.body || {}) as { userId?: string; spinCost?: number; prizes?: { id: string; name: string; type: string; value: number; probability: number }[] }
    if (!userId || !authedUserId || authedUserId !== userId) return res.status(403).json({ error: 'Forbidden' })
    const cost = Number(spinCost || 500)
    if (!Number.isFinite(cost) || cost <= 0) return res.status(400).json({ error: 'Invalid spin cost' })

    const { data: profile, error: profErr } = await supabase!
      .from('user_profiles')
      .select('id, username, role, free_coin_balance, badge')
      .eq('id', userId)
      .single()
    if (profErr || !profile) return res.status(404).json({ error: 'User not found' })

    const freeBal = Number(profile.free_coin_balance || 0)
    if (freeBal < cost) return res.status(400).json({ error: 'Insufficient free coin balance' })

    const now = new Date().toISOString()

    const { error: deductErr } = await supabase!
      .from('user_profiles')
      .update({ free_coin_balance: freeBal - cost, updated_at: now })
      .eq('id', userId)
    if (deductErr) throw deductErr

    const items: { id: string; name: string; type: string; value: number; probability: number }[] = Array.isArray(prizes) && prizes.length > 0 ? prizes : [
      { id: '1', name: '750 Coins', type: 'coins', value: 750, probability: 28 },
      { id: '2', name: 'Nothing', type: 'nothing', value: 0, probability: 23 },
      { id: '3', name: 'Insurance', type: 'insurance', value: 1, probability: 10 },
      { id: '4', name: '200 Coins', type: 'coins', value: 200, probability: 14 },
      { id: '5', name: '2x Multiplier', type: 'multiplier', value: 2, probability: 9 },
      { id: '6', name: 'BANKRUPT (Free Coins)', type: 'bankrupt', value: 0, probability: 5 },
      { id: '7', name: '5000 Coins', type: 'coins', value: 5000, probability: 7 },
      { id: '8', name: '1,000,000 Coins', type: 'coins', value: 1000000, probability: 2 },
      { id: '9', name: 'Troll Crown (Jackpot)', type: 'jackpot', value: 1, probability: 2 },
    ]

    const rnd = Math.random() * 100
    let acc = 0
    let prize = items[0]
    for (const p of items) { acc += Number(p.probability || 0); if (rnd <= acc) { prize = p; break } }

    const applyAward = async () => {
      if (prize.type === 'coins') {
        const { data: cur } = await supabase!
          .from('user_profiles')
          .select('id, free_coin_balance')
          .eq('id', userId)
          .single()
        const newBal = Number(cur?.free_coin_balance || 0) + Number(prize.value || 0)
        const { data: updated } = await supabase!
          .from('user_profiles')
          .update({ free_coin_balance: newBal, updated_at: now })
          .eq('id', userId)
          .select('*')
          .single()
        return updated
      } else if (prize.type === 'insurance') {
        const { data: updated } = await supabase!
          .from('user_profiles')
          .update({ has_insurance: true, updated_at: now })
          .eq('id', userId)
          .select('*')
          .single()
        return updated
      } else if (prize.type === 'multiplier') {
        const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString()
        const { data: updated } = await supabase!
          .from('user_profiles')
          .update({ multiplier_active: true, multiplier_value: Number(prize.value || 0), multiplier_expires: expires, updated_at: now })
          .eq('id', userId)
          .select('*')
          .single()
        return updated
      } else if (prize.type === 'bankrupt') {
        const { data: updated } = await supabase!
          .from('user_profiles')
          .update({ free_coin_balance: 0, updated_at: now })
          .eq('id', userId)
          .select('*')
          .single()
        return updated
      } else if (prize.type === 'jackpot') {
        const { data: updated } = await supabase!
          .from('user_profiles')
          .update({ badge: 'crown', updated_at: now })
          .eq('id', userId)
          .select('*')
          .single()
        return updated
      }
      return profile
    }

    let finalProfile
    try {
      finalProfile = await applyAward()
    } catch (awardErr) {
      await supabase!
        .from('user_profiles')
        .update({ free_coin_balance: freeBal, updated_at: now })
        .eq('id', userId)
      throw awardErr
    }

    const today = new Date().toISOString().split('T')[0]
    const { data: spinRow } = await supabase!
      .from('wheel_spins')
      .select('id, spin_count')
      .eq('user_id', userId)
      .eq('spin_date', today)
      .maybeSingle()
    if (!spinRow) {
      await supabase!.from('wheel_spins').insert({ user_id: userId, spin_date: today, spin_count: 1 })
    } else {
      await supabase!.from('wheel_spins').update({ spin_count: Number(spinRow.spin_count || 0) + 1 }).eq('id', spinRow.id)
    }

    return res.json({ success: true, prize, profile: finalProfile })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg || 'Spin failed' })
  }
})
