import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { 
  DollarSign, TrendingUp, Calendar, AlertTriangle,
  Lock, ArrowRight, Clock, CheckCircle, Award, Star
} from 'lucide-react'
import { EarningsView, MonthlyEarnings } from '../types/earnings'
import RequestPayoutModal from '../components/RequestPayoutModal'
// Payment tiers based on payout amounts
const PAYOUT_TIERS = [
  { name: 'Starter', coins: 7000, usd: 21.00, color: '#cd7f32' },
  { name: 'Bronze', coins: 14000, usd: 49.50, color: '#c0c0c0' },
  { name: 'Silver', coins: 27000, usd: 90.00, color: '#ffd700' },
  { name: 'Gold', coins: 47000, usd: 150.00, color: '#ff4dd2' },
]

function getPayoutTier(coins: number) {
  let current = PAYOUT_TIERS[0]
  for (const tier of PAYOUT_TIERS) {
    if (coins >= tier.coins) {
      current = tier
    }
  }
  return current
}

export default function MyEarnings() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [earningsData, setEarningsData] = useState<EarningsView | null>(null)
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarnings[]>([])
  const [loading, setLoading] = useState(true)
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutHistory, setPayoutHistory] = useState<Array<{
    id: string
    coins_redeemed?: number
    cash_amount?: number
    status?: string
    created_at: string
    processed_at?: string | null
  }>>([])

  const loadEarningsData = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      // Load earnings view data
      const { data: earnings, error: earningsError } = await supabase
        .from('earnings_view')
        .select('*')
        .eq('id', user.id)
        .single()

      if (earningsError) {
        // PGRST205 = table/view not found, PGRST116 = no rows found
        // For PGRST205 (table not found) or any other error, use fallback
        // PGRST116 (no rows) means view exists but no data - that's OK, we'll use empty data
        // Use fallback for PGRST205 (table not found) or any error except PGRST116 (no rows)
        if (earningsError.code === 'PGRST205' || earningsError.code !== 'PGRST116') {
          console.warn('earnings_view not found (code:', earningsError.code, '), using profile fallback')
          // Fallback to profile data
          setEarningsData({
            id: profile?.id || '',
            username: profile?.username || '',
            total_earned_coins: profile?.total_earned_coins || 0,
            troll_coins: profile?.troll_coins || 0,
            current_month_earnings: 0,
            current_month_transactions: 0,
            current_month_paid_out: 0,
            current_month_pending: 0,
            current_month_approved: 0,
            current_month_paid_count: 0,
            current_month_pending_count: 0,
            yearly_paid_usd: 0,
            yearly_payout_count: 0,
            tax_year: new Date().getFullYear(),
            irs_threshold_status: 'below_threshold',
            last_payout_at: null,
            pending_requests_count: 0,
            lifetime_paid_usd: 0
          })
        }
      } else if (earnings) {
        setEarningsData(earnings)
      } else {
        // No earnings data and no error - set empty data
        setEarningsData({
          id: profile?.id || '',
          username: profile?.username || '',
          total_earned_coins: profile?.total_earned_coins || 0,
          troll_coins: profile?.troll_coins || 0,
          current_month_earnings: 0,
          current_month_transactions: 0,
          current_month_paid_out: 0,
          current_month_pending: 0,
          current_month_approved: 0,
          current_month_paid_count: 0,
          current_month_pending_count: 0,
          yearly_paid_usd: 0,
          yearly_payout_count: 0,
          tax_year: new Date().getFullYear(),
          irs_threshold_status: 'below_threshold',
          last_payout_at: null,
          pending_requests_count: 0,
          lifetime_paid_usd: 0
        })
      }

      // Load monthly earnings - try RPC first, then view, then empty array
      try {
        const { data: monthly, error: monthlyError } = await supabase
          .rpc('get_monthly_earnings', { p_user_id: user.id })

        if (monthlyError) {
          console.warn('get_monthly_earnings RPC not found, trying view fallback:', monthlyError)
          // Fallback: load from monthly_earnings_breakdown view
          const { data: fallback, error: viewError } = await supabase
            .from('monthly_earnings_breakdown')
            .select('*')
            .eq('user_id', user.id)
            .order('month', { ascending: false })
            .limit(12)

          if (viewError) {
            console.warn('monthly_earnings_breakdown view also not found, using empty array')
            setMonthlyEarnings([])
          } else if (fallback) {
            setMonthlyEarnings(fallback.map(m => ({
              month: m.month,
              coins_earned_from_gifts: m.coins_earned_from_gifts || 0,
              gift_count: m.gift_count || 0,
              unique_gifters: m.unique_gifters || 0,
              troll_coins_earned: (m.troll_coins_earned || 0) + (m.free_coins_earned || 0)
            })))
          } else {
            setMonthlyEarnings([])
          }
        } else if (monthly) {
          setMonthlyEarnings(monthly)
        } else {
        setMonthlyEarnings([])
      }
    } catch (err) {
      console.warn('Error loading monthly earnings (non-critical):', err)
      setMonthlyEarnings([])
    }
      try {
        const { data, error } = await supabase
          .from('payout_history_view')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (error) {
          const { data: prData } = await supabase
            .from('payout_requests')
            .select('id, coins_redeemed, requested_coins, cash_amount, amount_usd, status, created_at, processed_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)
          const mapped = (prData || []).map((p: any) => ({
            id: p.id,
            coins_redeemed: p.coins_redeemed ?? p.requested_coins ?? 0,
            cash_amount: p.cash_amount ?? p.amount_usd ?? 0,
            status: p.status,
            created_at: p.created_at,
            processed_at: p.processed_at ?? null
          }))
          setPayoutHistory(mapped)
        } else {
          setPayoutHistory((data as any) || [])
        }
      } catch (err) {
        console.warn('Error loading payout history (non-critical):', err)
        setPayoutHistory([])
      }
    } catch (err: any) {
      console.error('Error loading earnings:', err)
      toast.error('Failed to load earnings data')
      setEarningsData(null)
      setMonthlyEarnings([])
    } finally {
      setLoading(false)
    }
  }, [user, profile])

  useEffect(() => {
    if (!user || !profile) {
      navigate('/auth', { replace: true })
      return
    }

    // Check W9/onboarding status
    if (profile.w9_status !== 'submitted' && profile.w9_status !== 'verified') {
      // Show lock screen - user needs to complete onboarding
      return
    }

    loadEarningsData()
  }, [user, profile, navigate, loadEarningsData])

  const totalEarned = earningsData?.total_earned_coins || profile?.total_earned_coins || 0

  // Check if W9/onboarding is required (only if user has earnings or pending payouts)
  const hasEarningsOrPayouts = totalEarned > 0 || (earningsData?.current_month_pending || 0) > 0 || (earningsData?.pending_requests_count || 0) > 0
  if (profile && hasEarningsOrPayouts && profile.w9_status !== 'submitted' && profile.w9_status !== 'verified') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-yellow-500/30 rounded-xl p-8 text-center">
          <Lock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-yellow-400 mb-2">Creator Onboarding Required</h2>
          <p className="text-gray-300 mb-6">
            You must complete creator onboarding and W9 information before you can view earnings or request payouts.
          </p>
          <button
            type="button"
            onClick={() => navigate('/onboarding/creator', { replace: true })}
            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto"
          >
            Complete Onboarding
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <p>Please log in to view your earnings.</p>
      </div>
    )
  }

  const payoutsDisabled = true
  const availableCoins = earningsData?.troll_coins || profile?.troll_coins || 0
  const pendingPayouts = earningsData?.current_month_pending || 0
  const totalCashedOut = earningsData?.lifetime_paid_usd || 0
  const yearlyPaid = earningsData?.yearly_paid_usd || 0
  const isOverThreshold = yearlyPaid >= 600
  const isNearingThreshold = yearlyPaid >= 500 && yearlyPaid < 600
  const canRequestPayout = !payoutsDisabled && availableCoins >= 7000 && (profile?.w9_status === 'submitted' || profile?.w9_status === 'verified') // Minimum 7,000 coins ($21) and onboarding completed

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-400" />
            My Earnings
          </h1>
          <div className="flex flex-col items-end">
            <div className="px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-sm text-purple-200">
              <span className="font-semibold text-purple-400">Automated Payouts:</span> Mondays & Fridays
            </div>
          </div>
        </div>

        {payoutsOnHold && (
          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold text-yellow-500">Payouts Currently Paused</h3>
              <p className="text-gray-300">
                Automated payouts are currently on hold for administrative review. 
                Your earnings are safe and will be processed when the system resumes. 
                Thank you for your patience.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C] animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Stats Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-gray-400">Total Earned Coins</span>
                </div>
                <p className="text-3xl font-bold text-purple-400">
                  {totalEarned.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">lifetime earnings</p>
              </div>

              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-gold-500/30 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-400">Available Coins</span>
                </div>
                <p className="text-3xl font-bold text-yellow-400">
                  {availableCoins.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">${(availableCoins * 0.01).toFixed(2)} withdrawable</p>
              </div>

              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-blue-500/30 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-gray-400">Pending Payouts</span>
                </div>
                <p className="text-3xl font-bold text-blue-400">
                  ${pendingPayouts.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">awaiting processing</p>
              </div>

              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-green-500/30 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-gray-400">Total Cashed Out</span>
                </div>
                <p className="text-3xl font-bold text-green-400">
                  ${totalCashedOut.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">lifetime payouts</p>
              </div>
            </div>

            {/* Payment Tiers Section */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                Payment Tiers
              </h2>
              
              {(() => {
                const currentTier = getPayoutTier(availableCoins)
                const currentTierIndex = PAYOUT_TIERS.findIndex(t => t.name === currentTier.name)
                const nextTier = currentTierIndex < PAYOUT_TIERS.length - 1 ? PAYOUT_TIERS[currentTierIndex + 1] : null
                const progressToNext = nextTier 
                  ? ((availableCoins - currentTier.coins) / (nextTier.coins - currentTier.coins)) * 100
                  : 100

                return (
                  <div className="space-y-4">
                    {/* Current Tier Display */}
                    <div className="bg-gradient-to-r from-purple-900/50 to-purple-800/50 rounded-lg p-4 border-2" style={{ borderColor: currentTier.color }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Star className="w-6 h-6" style={{ color: currentTier.color }} />
                          <div>
                            <p className="text-lg font-bold" style={{ color: currentTier.color }}>
                              {currentTier.name} Tier
                            </p>
                            <p className="text-sm text-gray-400">
                              ${currentTier.usd.toFixed(2)} payout available
                            </p>
                          </div>
                        </div>
                        {nextTier && (
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Next Tier</p>
                            <p className="text-sm font-semibold" style={{ color: nextTier.color }}>
                              {nextTier.name} (${nextTier.usd.toFixed(2)})
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {nextTier ? (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span>Progress to {nextTier.name} Tier</span>
                            <span>{Math.min(100, Math.max(0, progressToNext)).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(0, progressToNext))}%`,
                                backgroundColor: nextTier.color
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {((nextTier.coins - availableCoins).toLocaleString())} more coins needed for ${nextTier.usd.toFixed(2)} payout
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <p className="text-sm text-purple-300 font-semibold">
                            🎉 You've reached the highest payout tier!
                          </p>
                        </div>
                      )}
                    </div>

                    {/* All Tiers List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                      {PAYOUT_TIERS.map((tier, idx) => {
                        const isCurrentTier = tier.name === currentTier.name
                        const isUnlocked = availableCoins >= tier.coins
                        
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg p-3 border-2 transition-all ${
                              isCurrentTier
                                ? 'bg-gradient-to-br from-purple-900/30 to-purple-800/30 border-purple-500'
                                : isUnlocked
                                ? 'bg-zinc-800/50 border-gray-600'
                                : 'bg-zinc-900/50 border-gray-700 opacity-60'
                            }`}
                            style={isCurrentTier ? { borderColor: tier.color } : {}}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tier.color }}
                              />
                              <span
                                className={`text-sm font-semibold ${
                                  isCurrentTier ? 'text-white' : isUnlocked ? 'text-gray-300' : 'text-gray-500'
                                }`}
                              >
                                {tier.name}
                              </span>
                              {isCurrentTier && (
                                <span className="text-xs px-2 py-0.5 bg-purple-600 rounded-full">Current</span>
                              )}
                              {isUnlocked && !isCurrentTier && (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mb-1">
                              {tier.coins.toLocaleString()} coins
                            </p>
                            <p className="text-xs font-semibold text-green-400">
                              ${tier.usd.toFixed(2)} payout
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* IRS Warning Banner */}
            {isOverThreshold && (
              <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 border-2 border-red-500/50 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2">
                      IRS 1099 ALERT
                      <span className="px-3 py-1 bg-red-600 text-white text-sm rounded-full">REQUIRED</span>
                    </h3>
                    <p className="text-gray-200 mb-2">
                      You have reached the IRS reporting threshold. You have earned <strong>${yearlyPaid.toFixed(2)}</strong> this year.
                    </p>
                    <p className="text-sm text-gray-300">
                      You will be issued Form 1099 at the end of the year for tax reporting purposes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isNearingThreshold && !isOverThreshold && (
              <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 border-2 border-yellow-500/50 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-8 h-8 text-yellow-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-yellow-400 mb-2">Approaching IRS Threshold</h3>
                    <p className="text-gray-200">
                      You have earned <strong>${yearlyPaid.toFixed(2)}</strong> this year. Once you reach $600, you'll need to provide tax information for Form 1099.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Monthly Earnings Timeline */}
            {monthlyEarnings.length > 0 && (
              <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  Monthly Earnings Timeline
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {monthlyEarnings.map((month, idx) => {
                    // Handle month format (YYYY-MM string)
                    const monthStr = month.month
                    const monthDate = new Date(monthStr + '-01')
                    const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    
                    return (
                      <div 
                        key={idx}
                        className="bg-zinc-800 rounded-lg p-4 border border-purple-500/20 hover:border-purple-500/40 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-300">{monthName}</span>
                          <span className="text-xs text-gray-500">
                            ${((month.coins_earned_from_gifts || 0) * 0.01).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-purple-400 mb-2">
                          {(month.coins_earned_from_gifts || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>{month.gift_count || 0} gifts received</div>
                          <div>{month.unique_gifters || 0} unique gifters</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pending Payouts Alert */}
            {((earningsData?.pending_requests_count ?? 0) > 0) && (
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="font-semibold text-blue-400">
                      {(earningsData?.pending_requests_count ?? 0)} Pending Payout Request{(earningsData?.pending_requests_count ?? 0) > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-300">
                      Your payout request{(earningsData?.pending_requests_count ?? 0) > 1 ? 's are' : ' is'} being reviewed.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {payoutHistory.length > 0 && (
              <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Payout History
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400">
                        <th className="text-left py-2">Date</th>
                        <th className="text-right py-2">Coins</th>
                        <th className="text-right py-2">Amount</th>
                        <th className="text-center py-2">Status</th>
                        <th className="text-left py-2">Processed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutHistory.map((p) => (
                        <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="py-2 text-gray-300">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="text-right py-2 text-gray-300">
                            {(p.coins_redeemed || 0).toLocaleString()}
                          </td>
                          <td className="text-right py-2 font-semibold text-green-400">
                            ${((p.cash_amount || 0) as number).toFixed(2)}
                          </td>
                          <td className="text-center py-2">
                            <span className={`px-2 py-1 rounded text-xs capitalize ${
                              ['paid', 'success'].includes(p.status || '')
                                ? 'bg-green-900 text-green-300'
                                : ['approved', 'processing'].includes(p.status || '')
                                ? 'bg-blue-900 text-blue-300'
                                : ['rejected', 'failed'].includes(p.status || '')
                                ? 'bg-red-900 text-red-300'
                                : ['refunded'].includes(p.status || '')
                                ? 'bg-orange-900 text-orange-300'
                                : 'bg-yellow-900 text-yellow-300'
                            }`}>
                              {p.status === 'success' ? 'paid' : (p.status || 'pending')}
                            </span>
                          </td>
                          <td className="py-2 text-gray-300">
                            {p.processed_at ? new Date(p.processed_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </>
        )}
      </div>

      {/* Request Payout Modal */}
      {showPayoutModal && (
        <RequestPayoutModal
          userId={user.id}
          availableCoins={availableCoins}
          onClose={() => setShowPayoutModal(false)}
          onSuccess={() => {
            setShowPayoutModal(false)
            loadEarningsData()
            toast.success('Payout request submitted successfully!')
          }}
        />
      )}
    </div>
  )
}
