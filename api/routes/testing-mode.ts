import { Router, type Request, type Response } from 'express'
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

// Middleware to verify admin
const requireAdmin = async (req: AuthedRequest, res: Response, next: any) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' })
    }
    
    const authHeader = req.headers.authorization
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) return res.status(401).json({ success: false, error: 'Missing Authorization bearer token' })
    
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return res.status(401).json({ success: false, error: 'Invalid token' })
    
    req.userId = data.user.id
    
    // Verify admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()
    
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' })
    }
    
    next()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ success: false, error: 'Auth verification failed', details: msg })
  }
}

// Get testing mode status
router.get('/status', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' })
    }
    
    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('*')
      .in('key', ['testing_mode', 'test_user_benefits'])
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
    
    const testingMode = settings?.find(s => s.key === 'testing_mode')?.value || { enabled: false, signup_limit: 15, current_signups: 0 }
    const benefits = settings?.find(s => s.key === 'test_user_benefits')?.value || { free_coins: 5000, bypass_family_fee: true, bypass_admin_message_fee: true }
    
    // Get actual test user count
    const { count } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_test_user', true)
    
    return res.json({
      success: true,
      testingMode,
      benefits,
      actualTestUsers: count || 0
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ success: false, error: msg })
  }
})

// Toggle testing mode
router.post('/toggle', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' })
    }
    
    const { enabled, resetCounter } = req.body as { enabled: boolean; resetCounter?: boolean }
    
    const { data, error } = await supabase.rpc('toggle_testing_mode', {
      p_enabled: enabled,
      p_reset_counter: resetCounter || false
    })
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
    
    return res.json({ success: true, testingMode: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ success: false, error: msg })
  }
})

// Reset signup counter
router.post('/reset-counter', requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' })
    }
    
    const { data: current } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'testing_mode')
      .single()
    
    const updated = { ...(current?.value || {}), current_signups: 0 }
    
    const { error } = await supabase
      .from('app_settings')
      .update({ value: updated, updated_at: new Date().toISOString() })
      .eq('key', 'testing_mode')
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
    
    return res.json({ success: true, testingMode: updated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ success: false, error: msg })
  }
})

export default router
