import { Router } from 'express'
import { evaluateCashoutEligibility } from '../lib/protection.js'
import { getRevenueSettings } from '../lib/revenue.js'
import { adminClient } from '../lib/economy.js'

const router = Router()

// Middleware: require authentication
function requireAuth(req: any, res: any, next: any) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

// POST /api/cashouts/request
router.post('/request', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id
    const { usd_value, requested_coins, payout_method, payout_details } = req.body

    // Validate input
    if (!usd_value || !requested_coins || !payout_method) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check eligibility
    const eligibility = await evaluateCashoutEligibility({ 
      user_id: userId, 
      usd_value 
    })

    if (!eligibility.eligible) {
      return res.status(400).json({ 
        error: 'Not eligible for cashout',
        reason: eligibility.reason 
      })
    }

    // Calculate hold period
    const settings = await getRevenueSettings()
    const holdUntil = new Date()
    holdUntil.setDate(holdUntil.getDate() + settings.cashout_hold_days)

    // Create cashout request
    const { data, error } = await adminClient
      .from('cashout_requests')
      .insert({
        user_id: userId,
        usd_value,
        requested_coins,
        payout_method,
        payout_details,
        status: 'pending',
        eligible: true,
        hold_until: holdUntil.toISOString(),
        rejected_reason: null
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create cashout request:', error)
      return res.status(400).json({ error: error.message })
    }

    res.json({ 
      success: true,
      cashout: data, 
      eligibility,
      hold_until: holdUntil.toISOString(),
      hold_days: settings.cashout_hold_days
    })
  } catch (err: any) {
    console.error('Cashout request error:', err)
    res.status(500).json({ error: err.message || 'Failed to create cashout request' })
  }
})

// GET /api/cashouts/my-requests
router.get('/my-requests', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id

    const { data, error } = await adminClient
      .from('cashout_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({ cashouts: data || [] })
  } catch (err: any) {
    console.error('Failed to fetch cashouts:', err)
    res.status(500).json({ error: 'Failed to fetch cashout requests' })
  }
})

// GET /api/cashouts/settings
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getRevenueSettings()
    
    res.json({
      min_cashout_usd: settings.min_cashout_usd,
      min_stream_hours: settings.min_stream_hours_for_cashout,
      hold_days: settings.cashout_hold_days,
      tax_form_required: settings.tax_form_required
    })
  } catch (err: any) {
    console.error('Failed to fetch settings:', err)
    res.status(500).json({ error: 'Failed to fetch cashout settings' })
  }
})

export default router
