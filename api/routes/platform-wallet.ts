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

router.get('/platform-wallet', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Conversion rate: 100 coins = $1 USD (or 0.01 USD per coin)
    const COINS_PER_DOLLAR = 100
    const coinToUSD = (coins: number) => coins / COINS_PER_DOLLAR

    // 1️⃣ Total REAL revenue from Square payments (coin purchases)
    const { data: purchases } = await supabase
      .from('coin_transactions')
      .select('amount, metadata')
      .eq('type', 'coin_purchase')
      .eq('coin_type', 'paid')

    const totalPurchaseCoins = purchases?.reduce((sum, p) => sum + Math.abs(p.amount), 0) || 0
    const totalRevenueUSD = purchases?.reduce((sum, p) => {
      const usd = Number(p.metadata?.amount_usd || 0)
      return sum + usd
    }, 0) || 0

    // 2️⃣ Shop revenue (insurance, effects, perks) - platform keeps 100%
    const { data: shopRevenue } = await supabase
      .from('coin_transactions')
      .select('amount')
      .in('type', ['insurance_purchase', 'entrance_effect', 'perk_purchase'])

    const totalShopCoins = shopRevenue?.reduce((sum, p) => sum + Math.abs(p.amount), 0) || 0
    const shopRevenueUSD = coinToUSD(totalShopCoins)

    // 3️⃣ Platform's share of gifts (40% of paid gifts)
    const { data: revenueSettings } = await supabase
      .from('revenue_settings')
      .select('platform_cut_pct')
      .eq('id', 1)
      .single()

    const platformCutPct = revenueSettings?.platform_cut_pct || 40

    const { data: allGifts } = await supabase
      .from('gifts')
      .select('coins_spent')
      .eq('gift_type', 'paid')

    const totalGiftRevenue = allGifts?.reduce((sum, g) => sum + g.coins_spent, 0) || 0
    const platformGiftShare = Math.floor(totalGiftRevenue * (platformCutPct / 100))
    const platformGiftShareUSD = coinToUSD(platformGiftShare)

    // 4️⃣ Total broadcaster earnings owed (cashout liability)
    const { data: broadcasterEarnings } = await supabase
      .from('broadcaster_earnings')
      .select('coins_received')

    const totalBroadcasterEarningsCoins = broadcasterEarnings?.reduce((sum, e) => sum + e.coins_received, 0) || 0

    // 5️⃣ Total cashouts already paid
    const { data: paidCashouts } = await supabase
      .from('cashout_requests')
      .select('usd_value')
      .in('status', ['completed', 'paid'])

    const totalPaidCashoutsUSD = paidCashouts?.reduce((sum, c) => sum + Number(c.usd_value || 0), 0) || 0

    // 6️⃣ Pending cashout requests
    const { data: pendingCashouts } = await supabase
      .from('cashout_requests')
      .select('usd_value')
      .eq('status', 'pending')

    const pendingCashoutsUSD = pendingCashouts?.reduce((sum, c) => sum + Number(c.usd_value || 0), 0) || 0

    // 7️⃣ Admin coin balance
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance, free_coin_balance')
      .eq('email', 'trollcity2025@gmail.com')
      .single()

    const adminPaidCoins = adminProfile?.paid_coin_balance || 0
    const adminFreeCoins = adminProfile?.free_coin_balance || 0
    const adminTotalCoins = adminPaidCoins + adminFreeCoins
    const adminCoinValueUSD = coinToUSD(adminTotalCoins)

    // 8️⃣ Officer commission earnings
    const { data: officerEarnings } = await supabase
      .from('officer_earnings')
      .select('commission_coins')

    const totalOfficerCommissions = officerEarnings?.reduce((sum, e) => sum + e.commission_coins, 0) || 0
    const officerCommissionsUSD = coinToUSD(totalOfficerCommissions)

    // 9️⃣ Calculate final numbers
    const totalRevenueAllSourcesUSD = totalRevenueUSD + shopRevenueUSD + platformGiftShareUSD
    const broadcasterLiabilityUSD = coinToUSD(totalBroadcasterEarningsCoins)
    const remainingLiabilityUSD = broadcasterLiabilityUSD - totalPaidCashoutsUSD
    
    // Net spendable profit = Total revenue - liabilities - officer commissions + admin internal balance
    const netSpendableUSD = totalRevenueAllSourcesUSD - remainingLiabilityUSD - officerCommissionsUSD

    return res.json({
      // Revenue breakdown
      coinPurchases: {
        coins: totalPurchaseCoins,
        usd: totalRevenueUSD.toFixed(2)
      },
      shopRevenue: {
        coins: totalShopCoins,
        usd: shopRevenueUSD.toFixed(2)
      },
      giftRevenue: {
        totalGiftCoins: totalGiftRevenue,
        platformShare: platformGiftShare,
        platformShareUSD: platformGiftShareUSD.toFixed(2),
        platformCutPercent: platformCutPct
      },
      totalRevenue: {
        usd: totalRevenueAllSourcesUSD.toFixed(2)
      },

      // Liabilities
      broadcasterEarnings: {
        totalCoins: totalBroadcasterEarningsCoins,
        totalUSD: broadcasterLiabilityUSD.toFixed(2)
      },
      cashouts: {
        paidUSD: totalPaidCashoutsUSD.toFixed(2),
        pendingUSD: pendingCashoutsUSD.toFixed(2),
        remainingLiabilityUSD: remainingLiabilityUSD.toFixed(2)
      },
      officerCommissions: {
        coins: totalOfficerCommissions,
        usd: officerCommissionsUSD.toFixed(2)
      },

      // Admin balance
      adminBalance: {
        paidCoins: adminPaidCoins,
        freeCoins: adminFreeCoins,
        totalCoins: adminTotalCoins,
        valueUSD: adminCoinValueUSD.toFixed(2)
      },

      // Final calculation
      netSpendableProfit: {
        usd: netSpendableUSD.toFixed(2),
        breakdown: `$${totalRevenueAllSourcesUSD.toFixed(2)} revenue - $${remainingLiabilityUSD.toFixed(2)} liability - $${officerCommissionsUSD.toFixed(2)} commissions`
      }
    })
  } catch (err: any) {
    console.error('Platform wallet error:', err)
    res.status(500).json({ error: err.message || 'Failed to fetch platform wallet' })
  }
})

export default router
