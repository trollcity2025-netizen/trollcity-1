import { Router, Request, Response } from 'express'
import { getSupabaseAdmin } from '../lib/supabase'

const router = Router()
const supabase = getSupabaseAdmin()

// Middleware: require admin authentication
function requireAdmin(req: any, res: any, next: any) {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.userId = userId
  next()
}

router.get('/profit-summary', requireAdmin, async (req: Request, res: Response) => {
  try {
    // 1. Get total paid coin purchases (REAL money from Square)
    const { data: purchases } = await supabase
      .from('coin_transactions')
      .select('amount')
      .in('type', ['coin_purchase', 'square_payment'])

    const totalPaidCoins = purchases?.reduce((sum, p) => sum + Math.abs(p.amount), 0) || 0

    // 2. Get total coins spent on shop items (insurance, effects, perks)
    const { data: shopRevenue } = await supabase
      .from('coin_transactions')
      .select('amount')
      .in('type', ['insurance_purchase', 'entrance_effect', 'perk_purchase'])

    const totalShopRevenue = shopRevenue?.reduce((sum, p) => sum + Math.abs(p.amount), 0) || 0

    // 3. Total streamer earnings owed (cashout liability)
    const { data: earnings } = await supabase
      .from('broadcaster_earnings')
      .select('coins_received')

    const totalLiabilityCoins = earnings?.reduce((sum, e) => sum + e.coins_received, 0) || 0

    // 4. Pending approved cashouts
    const { data: pendingCashouts } = await supabase
      .from('cashout_requests')
      .select('usd_value')
      .eq('status', 'pending')

    const pendingCashoutUSD = pendingCashouts?.reduce((sum, c) => sum + Number(c.usd_value || 0), 0) || 0

    // 5. Get admin profile
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance, free_coin_balance, email')
      .eq('email', 'trollcity2025@gmail.com')
      .single()

    const adminPaidCoins = adminProfile?.paid_coin_balance || 0
    const adminFreeCoins = adminProfile?.free_coin_balance || 0
    const adminTotalCoins = adminPaidCoins + adminFreeCoins

    // 6. Platform revenue split (40% platform, 60% broadcaster)
    const { data: revenueSettings } = await supabase
      .from('revenue_settings')
      .select('platform_cut_pct, broadcaster_cut_pct')
      .eq('id', 1)
      .single()

    const platformCutPct = revenueSettings?.platform_cut_pct || 40

    // 7. Calculate platform's share of gift revenue
    const { data: allGifts } = await supabase
      .from('gifts')
      .select('coins_spent')
      .eq('gift_type', 'paid')

    const totalGiftRevenue = allGifts?.reduce((sum, g) => sum + g.coins_spent, 0) || 0
    const platformGiftShare = Math.floor(totalGiftRevenue * (platformCutPct / 100))

    // 8. Real platform profit calculation
    // Revenue: Coin purchases + Shop revenue + Platform's share of gifts
    // Liability: Broadcaster earnings owed
    const totalRevenue = totalPaidCoins + totalShopRevenue + platformGiftShare
    const platformSpendableCoins = totalRevenue - totalLiabilityCoins

    // 9. USD conversions (0.0001 USD per coin)
    const coinToUSD = (coins: number) => (coins * 0.0001).toFixed(2)

    return res.json({
      totalPaidCoins,
      totalPaidCoinsUSD: coinToUSD(totalPaidCoins),
      totalShopRevenue,
      totalShopRevenueUSD: coinToUSD(totalShopRevenue),
      totalGiftRevenue,
      platformGiftShare,
      platformGiftShareUSD: coinToUSD(platformGiftShare),
      totalRevenue,
      totalRevenueUSD: coinToUSD(totalRevenue),
      totalLiabilityCoins,
      totalLiabilityUSD: coinToUSD(totalLiabilityCoins),
      pendingCashoutUSD: pendingCashoutUSD.toFixed(2),
      adminPaidCoins,
      adminFreeCoins,
      adminTotalCoins,
      platformSpendableCoins,
      platformSpendableUSD: coinToUSD(platformSpendableCoins),
      platformCutPct,
    })
  } catch (error: any) {
    console.error('Profit summary error:', error)
    res.status(500).json({ error: error.message || 'Failed to get profit summary' })
  }
})

export default router
