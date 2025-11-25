import { Router, type Request, type Response, type NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null

const router = Router()

interface AuthedRequest extends Request {
  adminUser?: { id: string; email?: string | null }
  officerUser?: { id: string }
}

// Admin auth middleware: allow users with role 'admin' in user_profiles
const requireAdmin = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' })
    }
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })

    // Support anon-key based client by setting the incoming JWT
    try { await supabase.auth.setAuth(token!) } catch {}
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' })
    const uid = data.user.id
    req.adminUser = { id: uid, email: data.user?.email || null }
    try {
      const { data: prof } = await supabase!
        .from('user_profiles')
        .select('id, role')
        .eq('id', uid)
        .maybeSingle()
      if (!prof || (prof as any).role !== 'admin') {
        const adminEmail = (process.env.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com').trim().toLowerCase()
        const userEmail = String(data.user?.email || '').trim().toLowerCase()
        if (userEmail === adminEmail) {
          const existing = prof
          if (!existing) {
            await supabase!
              .from('user_profiles')
              .insert([{ id: uid, username: (data.user?.email || '').split('@')[0], role: 'admin', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
          } else {
            await supabase!
              .from('user_profiles')
              .update({ role: 'admin', updated_at: new Date().toISOString() })
              .eq('id', uid)
          }
        } else {
          return res.status(403).json({ error: 'Forbidden' })
        }
      }
    } catch {}
    next()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ error: 'Auth verification failed', details: msg })
  }
}

// Officers or Admins can access
const requireOfficerOrAdmin = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' })
    }
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return res.status(401).json({ error: 'Invalid token' })

    const uid = data.user.id
    const { data: profile, error: profErr } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('id', uid)
      .single()
    if (profErr || !profile) {
      const adminEmail = (process.env.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com').trim().toLowerCase()
      const email = String(data.user?.email || '').trim().toLowerCase()
      if (email === adminEmail) {
        await supabase!
          .from('user_profiles')
          .insert([{ id: uid, username: email.split('@')[0], role: 'admin', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      } else {
        return res.status(403).json({ error: 'Forbidden' })
      }
    } else if (profile.role !== 'troll_officer' && profile.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    req.officerUser = { id: uid }
    next()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ error: 'Auth verification failed', details: msg })
  }
}

router.get('/users', requireOfficerOrAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const { data, error } = await supabase!
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) throw error
    res.json({ success: true, users: data || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to fetch users', details: msg })
  }
})

router.delete('/reset/users', requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' })
    const { data: listed } = await supabase!.auth.admin.listUsers()
    const users = listed?.users || []
    for (const u of users) {
      try { await supabase!.auth.admin.deleteUser(u.id) } catch {}
    }
    await supabase!.from('user_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    res.json({ success: true, deleted: users.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to reset users', details: msg })
  }
})

// Update a user's role (admin only)
router.patch('/users/:id/role', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.params.id
    const { role } = req.body as { role: string }
    if (!role) return res.status(400).json({ error: 'Missing role' })

    const { error } = await supabase!
      .from('user_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) throw error
    res.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to update role', details: msg })
  }
})

router.get('/cashouts', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim()
    const provider = String(req.query.provider || '').trim()
    let query = supabase!
      .from('cashout_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (provider) query = query.eq('payout_method', provider)
    if (q) query = query.or(`username.ilike.%${q}%,email.ilike.%${q}%,payout_details.ilike.%${q}%`)
    const { data, error } = await query
    if (error) throw error
    res.json({ success: true, requests: data || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to fetch cashouts', details: msg })
  }
})

// Move cashout to processing with fee calculation
router.post('/cashouts/:id/process', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const id = req.params.id
    const { data: r, error: getErr } = await supabase!
      .from('cashout_requests')
      .select('*')
      .eq('id', id)
      .single()
    if (getErr || !r) throw getErr || new Error('Invalid payout ID')

    // Prefer configured tier; fallback to thresholds
    let basePerc = 5
    const { data: tier } = await supabase!
      .from('cashout_tiers')
      .select('processing_fee_percentage')
      .eq('coin_amount', r.requested_coins)
      .maybeSingle()
    if (tier && typeof (tier as any).processing_fee_percentage === 'number') {
      basePerc = Number((tier as any).processing_fee_percentage)
    } else {
      // Fallback to thresholds similar to your snippet
      const coins: number = Number(r.requested_coins || 0)
      if (coins >= 47000) basePerc = 25
      else if (coins >= 27000) basePerc = 18
      else if (coins >= 14000) basePerc = 9
      else if (coins >= 7000) basePerc = 4
      else basePerc = 0
    }

    const gross = Number(r.usd_value || 0)
    const fee = Number((gross * basePerc / 100).toFixed(2))
    const net = Number((gross - fee).toFixed(2))

    const { error: upErr } = await supabase!
      .from('cashout_requests')
      .update({ status: 'processing', admin_notes: `gross=${gross};fee=${fee};net=${net}`, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (upErr) throw upErr

    res.json({ success: true, payoutAmount: net, fee })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to process payout', details: msg })
  }
})

router.patch('/cashouts/:id/mark-paid', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const id = req.params.id
    const { payment_reference } = (req.body || {}) as { payment_reference?: string }
    const { data: r, error: getErr } = await supabase!
      .from('cashout_requests')
      .select('*')
      .eq('id', id)
      .single()
    if (getErr) throw getErr

    const { data: ban } = await supabase!
      .from('user_bans')
      .select('id')
      .eq('user_id', r.user_id)
      .eq('is_active', true)
      .maybeSingle()
    const { data: flag } = await supabase!
      .from('admin_flags')
      .select('id')
      .eq('user_id', r.user_id)
      .maybeSingle()
    const flagged = !!(ban || flag)

    const { data: tier } = await supabase!
      .from('cashout_tiers')
      .select('*')
      .eq('coin_amount', r.requested_coins)
      .maybeSingle()

    const gross = Number(r.usd_value || 0)
    const basePerc = Number((tier as any)?.processing_fee_percentage || 5)
    const fee = Number((gross * basePerc / 100).toFixed(2))
    const extraFee = flagged ? Number((gross * 0.01).toFixed(2)) : 0
    const net = Number((gross - fee - extraFee).toFixed(2))

    const { error: upErr } = await supabase!
      .from('cashout_requests')
      .update({ status: 'paid', fee_applied: fee + extraFee, usd_after_fee: net, transaction_ref: payment_reference || null, admin_notes: `gross=${gross};fee=${fee};extra=${extraFee};net=${net};ref=${payment_reference || ''}`, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (upErr) throw upErr

    const { data: txn, error: txnErr } = await supabase!
      .from('transactions')
      .insert([
        {
          user_id: r.user_id,
          type: 'cashout',
          transaction_type: 'cashout',
          coins_used: r.requested_coins,
          amount: net,
          description: 'Manual cashout',
          status: 'paid',
          payment_method: r.payout_method,
          metadata: { gross, net, fee, extraFee, before_fee: gross, after_fee: net, provider: r.payout_method, payout_details: r.payout_details, payment_reference: payment_reference || '' }
        }
      ])
      .select('*')
      .maybeSingle()
    if (txnErr) throw txnErr

    res.json({ success: true, net, fee, extraFee, transaction: txn })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to mark paid', details: msg })
  }
})

// Complete payout: set to paid if eligible, store transaction_ref, log transaction
router.post('/cashouts/:id/complete', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const id = req.params.id
    const { transaction_ref } = (req.body || {}) as { transaction_ref?: string }
    const { data: r, error: getErr } = await supabase!
      .from('cashout_requests')
      .select('*')
      .eq('id', id)
      .single()
    if (getErr || !r) throw getErr || new Error('Cashout not found')

    if (!['pending', 'processing'].includes(String(r.status))) {
      return res.status(400).json({ error: 'This request is not eligible for completion' })
    }

    const gross = Number(r.usd_value || 0)
    const feeApplied = r.fee_applied != null ? Number(r.fee_applied) : 0
    const net = r.usd_after_fee != null ? Number(r.usd_after_fee) : Number((gross - feeApplied).toFixed(2))

    const { error: upErr } = await supabase!
      .from('cashout_requests')
      .update({ status: 'paid', transaction_ref: transaction_ref || null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (upErr) throw upErr

    const { error: insErr } = await supabase!
      .from('transactions')
      .insert([
        {
          user_id: r.user_id,
          type: 'cashout',
          transaction_type: 'cashout',
          coins_used: r.requested_coins,
          amount: net,
          description: 'Cashout completed',
          status: 'paid',
          payment_method: r.payout_method,
          metadata: { cashout_id: id, amount_before_fee: gross, amount_after_fee: net, fee_applied: feeApplied, transaction_ref: transaction_ref || null }
        }
      ])
    if (insErr) throw insErr

    res.json({ success: true, cashoutId: id, transactionRef: transaction_ref || null })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to complete payout', details: msg })
  }
})

router.patch('/cashouts/:id/mark-completed', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const id = req.params.id
    const { payment_reference } = (req.body || {}) as { payment_reference?: string }
    const { error: upErr } = await supabase!
      .from('cashout_requests')
      .update({ status: 'completed', admin_notes: payment_reference ? `ref=${payment_reference}` : undefined, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (upErr) throw upErr
    res.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to mark completed', details: msg })
  }
})

export default router

// Hard delete a stream and related data (admin only)
router.delete('/streams/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const streamId = req.params.id
    // Delete related rows first
    await supabase!.from('messages').delete().eq('stream_id', streamId)
    await supabase!.from('gifts').delete().eq('stream_id', streamId)
    await supabase!.from('stream_reports').delete().eq('stream_id', streamId)
    await supabase!.from('transactions').delete().eq('metadata->>stream_id', streamId as any)
    // Finally delete stream
    const { error } = await supabase!.from('streams').delete().eq('id', streamId)
    if (error) throw error
    res.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to hard delete stream', details: msg })
  }
})

// Officer-only: send a direct message to Admin
router.post('/message-admin', requireOfficerOrAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { text } = (req.body || {}) as { text?: string }
    if (!text || !req.officerUser) return res.status(400).json({ error: 'Missing text' })
    const { data: admin } = await supabase!
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()
    const adminId = admin?.id || null
    await supabase!.from('messages').insert([
      {
        stream_id: null,
        user_id: req.officerUser.id,
        receiver_id: adminId,
        content: text,
        message_type: 'message_admin',
        gift_amount: null
      }
    ])
    res.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to send', details: msg })
  }
})

// Revoke a user's perks (admin or officer)
router.post('/revoke-perks', requireOfficerOrAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { target_id } = (req.body || {}) as { target_id?: string }
    if (!target_id) return res.status(400).json({ error: 'Missing target_id' })
    await supabase!.from('admin_flags').insert([{ user_id: target_id, reason: 'perks_revoked', created_at: new Date().toISOString() }])
    res.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'Failed to revoke', details: msg })
  }
})
