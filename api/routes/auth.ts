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

router.post('/fix-admin-role', async (req: Request, res: Response): Promise<any> => {
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
    
    const adminEmail = (process.env.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com').trim().toLowerCase()
    const userEmail = String(data.user.email || '').trim().toLowerCase()
    
    if (userEmail !== adminEmail) {
      return res.status(403).json({ error: 'Not admin email' })
    }
    
    // First, get the existing profile to preserve all data
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()
    
    if (fetchError || !existingProfile) {
      return res.status(500).json({ error: fetchError?.message || 'Profile not found' })
    }
    
    // Only update role if it's not already admin (preserves all other data)
    if (existingProfile.role !== 'admin') {
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ 
          role: 'admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', data.user.id)
      
      if (updateError) {
        return res.status(500).json({ error: updateError.message })
      }
      
      // Return updated profile
      return res.json({ success: true, profile: { ...existingProfile, role: 'admin' } })
    }
    
    // If already admin, just return existing profile
    return res.json({ success: true, profile: existingProfile })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
})

router.post('/signup', async (req: Request, res: Response): Promise<any> => {
  try {
    const url = process.env.SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) return res.status(503).json({ error: 'Supabase admin not configured' })
    const supabaseAdmin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

    const { email, password, username } = (req.body || {}) as { email?: string; password?: string; username?: string }
    if (!email || !password || !username) return res.status(400).json({ error: 'Missing email, password or username' })

    console.log(`[Signup] Creating user: ${email}, username: ${username}`)

    // Check testing mode and signup limit
    const { data: testingModeSettings } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'testing_mode')
      .single()
    
    const testingMode = testingModeSettings?.value || { enabled: false, signup_limit: 15, current_signups: 0 }
    const isTestingMode = testingMode.enabled
    
    if (isTestingMode && testingMode.current_signups >= testingMode.signup_limit) {
      console.log('[Signup] Signup limit reached in testing mode')
      return res.status(403).json({ error: 'Signups are currently limited. Testing mode is active and the signup limit has been reached. Please contact an administrator.' })
    }

    // Get test user benefits
    const { data: benefitsSettings } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'test_user_benefits')
      .single()
    
    const benefits = benefitsSettings?.value || { free_coins: 5000, bypass_family_fee: true, bypass_admin_message_fee: true }

    // Create user with email_confirm: true to skip confirmation email
    const trimmedUsername = username.trim()
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: trimmedUsername, is_test_user: isTestingMode },
      app_metadata: { username: trimmedUsername, is_test_user: isTestingMode }
    })
    
    if (createErr) {
      console.error('[Signup] Auth creation error:', createErr)
      return res.status(500).json({ error: createErr.message })
    }
    if (!created.user) {
      console.error('[Signup] No user returned')
      return res.status(500).json({ error: 'Create failed' })
    }

    console.log(`[Signup] User created successfully: ${created.user.id}, is_test_user: ${isTestingMode}`)
    
    // Increment signup counter if testing mode is active
    if (isTestingMode) {
      const { error: incrementErr } = await supabaseAdmin
        .from('app_settings')
        .update({ 
          value: { ...testingMode, current_signups: testingMode.current_signups + 1 },
          updated_at: new Date().toISOString()
        })
        .eq('key', 'testing_mode')
      
      if (incrementErr) {
        console.error('[Signup] Failed to increment signup counter:', incrementErr)
      } else {
        console.log(`[Signup] Signup counter incremented to ${testingMode.current_signups + 1}`)
      }
    }
    
    // Wait a moment for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Verify profile was created
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username')
      .eq('id', created.user.id)
      .maybeSingle()
    
    if (profileErr) {
      console.error('[Signup] Profile check error:', profileErr)
    } else if (!profile) {
      console.warn('[Signup] Profile not found after creation, trigger may have failed')
      // Manually create profile if trigger failed
      const isAdmin = email === 'trollcity2025@gmail.com'
      const testUserCoins = isTestingMode ? (benefits.free_coins || 5000) : 100
      
      const { error: manualCreateErr } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: created.user.id,
          username: isAdmin ? 'admin' : trimmedUsername,
          email: email,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${trimmedUsername}`,
          bio: 'New troll in the city!',
          role: isAdmin ? 'admin' : 'user',
          tier: 'Bronze',
          paid_coin_balance: 0,
          free_coin_balance: testUserCoins,
          total_earned_coins: testUserCoins,
          total_spent_coins: 0,
          is_test_user: isTestingMode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      if (manualCreateErr) {
        console.error('[Signup] Manual profile creation failed:', manualCreateErr)
      } else {
        console.log('[Signup] Profile manually created successfully with test user benefits')
      }
    } else {
      console.log(`[Signup] Profile verified: ${profile.username}`)
      
      // Update profile with test user status and coins if in testing mode
      if (isTestingMode) {
        const testUserCoins = benefits.free_coins || 5000
        const { error: updateErr } = await supabaseAdmin
          .from('user_profiles')
          .update({
            is_test_user: true,
            free_coin_balance: testUserCoins,
            total_earned_coins: testUserCoins,
            updated_at: new Date().toISOString()
          })
          .eq('id', created.user.id)
        
        if (updateErr) {
          console.error('[Signup] Failed to update test user status:', updateErr)
        } else {
          console.log(`[Signup] Test user benefits granted: ${testUserCoins} free coins`)
        }
      }
      
      // If profile exists but username is wrong, update it
      if (profile.username !== trimmedUsername && !profile.username.startsWith('user')) {
        const { error: updateErr } = await supabaseAdmin
          .from('user_profiles')
          .update({ username: trimmedUsername })
          .eq('id', created.user.id)
        if (updateErr) {
          console.error('[Signup] Username update failed:', updateErr)
        } else {
          console.log(`[Signup] Username updated to: ${trimmedUsername}`)
        }
      }
    }

    return res.json({ success: true, user_id: created.user.id })
  } catch (e: any) {
    console.error('[Signup] Unexpected error:', e)
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
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
