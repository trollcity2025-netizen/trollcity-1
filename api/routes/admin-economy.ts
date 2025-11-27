// api/routes/admin-economy.ts
import { Router, Request, Response } from 'express'
import { adminClient } from '../lib/economy.js'

const router = Router()

// Middleware: ensure requester is admin
async function requireAdmin(req: Request, res: Response, next: Function) {
  const userId = (req as any).user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { data, error } = await adminClient
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || data?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  next()
}

router.get('/summary', requireAdmin, async (_req, res) => {
  try {
    // Total paid coin purchases (liability)
    const { data: paidTx, error: paidErr } = await adminClient
      .from('coin_transactions')
      .select('amount, coin_type')
      .eq('coin_type', 'paid')

    if (paidErr) throw paidErr

    const totalPaidCoinsPurchased = paidTx.reduce((sum, t: any) => sum + (t.amount > 0 ? t.amount : 0), 0)
    const totalPaidCoinsSpent = paidTx.reduce((sum, t: any) => sum + (t.amount < 0 ? t.amount : 0), 0)

    const outstandingPaidCoinLiability = totalPaidCoinsPurchased + totalPaidCoinsSpent // spent are negative

    // Broadcaster earnings (what you owe / have paid)
    const { data: earnings, error: earnErr } = await adminClient
      .from('broadcaster_earnings')
      .select('usd_value')

    if (earnErr) throw earnErr

    const totalBroadcasterUsd = earnings.reduce((sum, e: any) => sum + Number(e.usd_value), 0)

    // Cashouts
    const { data: cashouts, error: cashErr } = await adminClient
      .from('cashout_requests')
      .select('status, usd_value')

    if (cashErr) throw cashErr

    let pendingUsd = 0
    let paidUsd = 0
    for (const c of cashouts) {
      if (c.status === 'pending' || c.status === 'processing') {
        pendingUsd += Number(c.usd_value)
      } else if (c.status === 'paid' || c.status === 'completed') {
        paidUsd += Number(c.usd_value)
      }
    }

    // Officer earnings
    const { data: officerEarn, error: offErr } = await adminClient
      .from('officer_earnings')
      .select('usd_value')

    if (offErr) throw offErr

    const totalOfficerUsd = officerEarn.reduce((sum, o: any) => sum + Number(o.usd_value), 0)

    // Wheel stats
    const { data: wheelSpins, error: wheelErr } = await adminClient
      .from('wheel_spins')
      .select('cost_coins, prize_coins, outcome')

    if (wheelErr) throw wheelErr

    const totalWheelCost = wheelSpins.reduce((s, w: any) => s + w.cost_coins, 0)
    const totalWheelPrizes = wheelSpins.reduce((s, w: any) => s + w.prize_coins, 0)
    const totalJackpots = wheelSpins.filter((w: any) => w.outcome === 'jackpot').length

    res.json({
      paidCoins: {
        totalPurchased: totalPaidCoinsPurchased,
        totalSpent: Math.abs(totalPaidCoinsSpent),
        outstandingLiability: outstandingPaidCoinLiability
      },
      broadcasters: {
        totalUsdOwed: totalBroadcasterUsd,
        pendingCashoutsUsd: pendingUsd,
        paidOutUsd: paidUsd
      },
      officers: {
        totalUsdPaid: totalOfficerUsd
      },
      wheel: {
        totalSpins: wheelSpins.length,
        totalCoinsSpent: totalWheelCost,
        totalCoinsAwarded: totalWheelPrizes,
        jackpotCount: totalJackpots
      }
    })
  } catch (err: any) {
    console.error('admin /economy/summary error', err)
    res.status(500).json({ error: 'Failed to load economy summary' })
  }
})

export default router
