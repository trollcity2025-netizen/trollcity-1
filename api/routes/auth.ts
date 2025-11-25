import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

const router = Router()

router.post('/admin-create-user', async (req: Request, res: Response): Promise<any> => {
  try {
    const url = process.env.SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) return res.status(503).json({ error: 'Supabase admin not configured' })
    const supabaseAdmin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

    const { email, password, role, username } = (req.body || {}) as { email?: string; password?: string; role?: string; username?: string }
    const r = String(role || 'user').toLowerCase()
    const allowed = ['admin', 'troll_officer', 'troller', 'user']
    if (!email || !password || !username) return res.status(400).json({ error: 'Missing email, password or username' })
    if (!allowed.includes(r)) return res.status(400).json({ error: 'Invalid role' })

    if (r === 'admin') {
      const { data: exists } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
      if ((exists || []).length > 0) return res.status(409).json({ error: 'Admin already initialized' })
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: r }
    })
    if (createErr || !created.user) return res.status(500).json({ error: createErr?.message || 'Create failed' })

    const uid = created.user.id
    const uname = String(username).trim().slice(0, 20)
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uname || email.split('@')[0]}`
    const { error: upErr } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: uid,
        username: uname,
        bio: null,
        role: r === 'troller' ? 'user' : r,
        tier: 'Bronze',
        paid_coin_balance: 0,
        free_coin_balance: 100,
        total_earned_coins: 100,
        total_spent_coins: 0,
        avatar_url: avatar,
        email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    if (upErr) return res.status(500).json({ error: upErr.message })

    return res.json({ success: true, user_id: uid })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

router.get('/admin-exists', async (_req: Request, res: Response): Promise<any> => {
  try {
    const url = process.env.SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) return res.status(503).json({ error: 'Supabase admin not configured' })
    const supabaseAdmin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data } = await supabaseAdmin.from('user_profiles').select('id').eq('role', 'admin').limit(1)
    const exists = (data || []).length > 0
    return res.json({ exists })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

router.get('/whoami', async (req: Request, res: Response): Promise<any> => {
  try {
    const url = process.env.SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) return res.status(503).json({ error: 'Supabase admin not configured' })
    const supabaseAdmin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    if (!token) return res.status(401).json({ error: 'Missing token' })
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' })
    return res.json({ success: true, id: data.user.id, email: data.user.email })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

router.post('/logout', async (_req: Request, res: Response): Promise<any> => {
  return res.status(200).json({ message: 'Logged out.' })
})

router.get('/config', async (_req: Request, res: Response): Promise<any> => {
  const url = process.env.SUPABASE_URL || ''
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const viteUrl = process.env.VITE_SUPABASE_URL || ''
  const viteAnon = process.env.VITE_SUPABASE_ANON_KEY || ''
  res.json({
    admin_configured: !!url && !!srk,
    frontend_configured: !!viteUrl && !!viteAnon
  })
})

export default router
