import { Router, Request, Response } from 'express'
import { adminClient } from '../lib/protection.js'

const router = Router()

async function requireAdmin(req: any, res: any, next: any) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { data, error } = await adminClient
    .from('user_profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (error || !data?.is_admin) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

router.get('/overview', requireAdmin, async (_req: Request, res: Response) => {
  const { data: frozen, error: frozenErr } = await adminClient
    .from('user_risk_profile')
    .select('user_id')
    .eq('is_frozen', true)

  const { data: highRisk, error: riskErr } = await adminClient
    .from('user_risk_profile')
    .select('user_id, risk_score')
    .gt('risk_score', 10)
    .order('risk_score', { ascending: false })
    .limit(10)

  if (frozenErr || riskErr) {
    return res.status(500).json({ error: 'Failed to load risk overview' })
  }

  res.json({
    frozenCount: frozen?.length ?? 0,
    topHighRisk: highRisk ?? []
  })
})

router.post('/freeze', requireAdmin, async (req: any, res: any) => {
  const { user_id, reason } = req.body
  const { data, error } = await adminClient
    .from('user_risk_profile')
    .upsert({
      user_id,
      is_frozen: true,
      freeze_reason: reason ?? 'Manual freeze',
      last_event_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json({ profile: data })
})

router.post('/unfreeze', requireAdmin, async (req: any, res: any) => {
  const { user_id } = req.body
  const { data, error } = await adminClient
    .from('user_risk_profile')
    .update({ is_frozen: false, freeze_reason: null })
    .eq('user_id', user_id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json({ profile: data })
})

export default router
