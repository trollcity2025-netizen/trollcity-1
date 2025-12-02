import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { 
  DollarSign, TrendingUp, FileText, Calendar, 
  AlertTriangle, CheckCircle, Clock, Download,
  ArrowRight
} from 'lucide-react'

interface EarningsTransaction {
  amount: number
  created_at: string
  type?: string
  description?: string
  metadata?: any
}

interface MonthlyEarnings {
  month: string
  coins_earned_from_gifts: number
  gift_count: number
  unique_gifters: number
  paid_coins_earned: number
  free_coins_earned: number
}

interface PayoutRequest {
  id: string
  cash_amount: number
  coins_redeemed: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  created_at: string
  processed_at?: string
  notes?: string
}

interface EarningsSummary {
  total_earned_coins: number
  current_month_earnings: number
  current_month_transactions: number
  yearly_paid_usd: number
  irs_threshold_status: 'over_threshold' | 'nearing_threshold' | 'below_threshold'
  pending_requests_count: number
  lifetime_paid_usd: number
  last_payout_at?: string
}

export default function EarningsDashboard() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [earnings, setEarnings] = useState<EarningsTransaction[]>([])
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthlyEarnings[]>([])
  const [payoutHistory, setPayoutHistory] = useState<PayoutRequest[]>([])
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !profile) return

    const loadEarnings = async () => {
      setLoading(true)
      try {
        await Promise.all([
          loadEarningsSummary(),
          loadTransactions(),
          loadMonthlyBreakdown(),
          loadPayoutHistory()
        ])
      } catch (err: any) {
        console.error('Error loading earnings:', err)
        toast.error('Failed to load earnings')
      } finally {
        setLoading(false)
      }
    }

    loadEarnings()
  }, [user, profile])

  const loadEarningsSummary = async () => {
    try {
      const { data, error } = await supabase
        .from('earnings_view')
        .select('*')
        .eq('id', profile?.id)
        .single()

      if (error) throw error
      if (data) {
        setSummary({
          total_earned_coins: data.total_earned_coins || 0,
          current_month_earnings: data.current_month_earnings || 0,
          current_month_transactions: data.current_month_transactions || 0,
          yearly_paid_usd: data.yearly_paid_usd || 0,
          irs_threshold_status: data.irs_threshold_status || 'below_threshold',
          pending_requests_count: data.pending_requests_count || 0,
          lifetime_paid_usd: data.lifetime_paid_usd || 0,
          last_payout_at: data.last_payout_at
        })
      }
    } catch (err: any) {
      console.error('Error loading earnings summary:', err)
      // Fallback to profile data
      setSummary({
        total_earned_coins: profile?.total_earned_coins || 0,
        current_month_earnings: 0,
        current_month_transactions: 0,
        yearly_paid_usd: 0,
        irs_threshold_status: 'below_threshold',
        pending_requests_count: 0,
        lifetime_paid_usd: 0
      })
    }
  }

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('coin_transactions')
        .select('amount, created_at, type, description, metadata')
        .eq('user_id', profile?.id)
        .in('type', ['gift_receive', 'gift', 'gift_bonus'])
        .gt('amount', 0)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setEarnings(data || [])
    } catch (err: any) {
      console.error('Error loading transactions:', err)
    }
  }

  const loadMonthlyBreakdown = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_earnings_breakdown')
        .select('*')
        .eq('user_id', profile?.id)
        .order('month', { ascending: false })
        .limit(12)

      if (error) throw error
      setMonthlyBreakdown(data || [])
    } catch (err: any) {
      console.error('Error loading monthly breakdown:', err)
    }
  }

  const loadPayoutHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_history_view')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setPayoutHistory(data || [])
    } catch (err: any) {
      console.error('Error loading payout history:', err)
    }
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <p>Please log in to view your earnings.</p>
      </div>
    )
  }

  const totalEarned = summary?.total_earned_coins || profile.total_earned_coins || 0
  const withdrawable = profile.paid_coin_balance || 0
  const yearlyPaid = summary?.yearly_paid_usd || 0
  const thresholdProgress = Math.min((yearlyPaid / 600) * 100, 100)
  const isOverThreshold = summary?.irs_threshold_status === 'over_threshold'
  const isNearingThreshold = summary?.irs_threshold_status === 'nearing_threshold'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-400" />
            My Earnings
          </h1>
          <button
            type="button"
            onClick={() => navigate('/withdraw')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center gap-2"
          >
            Request Payout
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="bg-zinc-900 rounded-xl p-8 text-center">
            <p className="text-gray-400">Loading earnings...</p>
          </div>
        ) : (
          <>
            {/* Earnings Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900 rounded-xl p-4 border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-gray-400">Total Earned</span>
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {totalEarned.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">coins</p>
              </div>

              <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-400">Withdrawable</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {withdrawable.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">coins (${(withdrawable / 100).toFixed(2)})</p>
              </div>

              <div className="bg-zinc-900 rounded-xl p-4 border border-blue-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-gray-400">This Month</span>
                </div>
                <p className="text-2xl font-bold text-blue-400">
                  {summary?.current_month_earnings?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {summary?.current_month_transactions || 0} transactions
                </p>
              </div>

              <div className="bg-zinc-900 rounded-xl p-4 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-gray-400">Lifetime Paid</span>
                </div>
                <p className="text-2xl font-bold text-purple-400">
                  ${summary?.lifetime_paid_usd?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-gray-500 mt-1">total payouts</p>
              </div>
            </div>

            {/* IRS Threshold Warning */}
            {(isOverThreshold || isNearingThreshold) && (
              <div className={`bg-zinc-900 rounded-xl p-4 border ${
                isOverThreshold ? 'border-red-500/50' : 'border-yellow-500/50'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-6 h-6 mt-0.5 ${
                    isOverThreshold ? 'text-red-400' : 'text-yellow-400'
                  }`} />
                  <div className="flex-1">
                    <h3 className={`font-bold mb-1 ${
                      isOverThreshold ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {isOverThreshold ? '⚠️ IRS 1099 Required' : '⚠️ Approaching IRS Threshold'}
                    </h3>
                    <p className="text-sm text-gray-300 mb-3">
                      {isOverThreshold 
                        ? `You have earned $${yearlyPaid.toFixed(2)} this year. You will receive a 1099 form for tax reporting.`
                        : `You have earned $${yearlyPaid.toFixed(2)} this year. Once you reach $600, you'll need to provide tax information.`
                      }
                    </p>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          isOverThreshold ? 'bg-red-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${Math.min(thresholdProgress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Progress: ${yearlyPaid.toFixed(2)} / $600.00
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 1099 Threshold Progress (if not over threshold) */}
            {!isOverThreshold && (
              <div className="bg-zinc-900 rounded-xl p-4 border border-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-gray-300 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    1099 Threshold: $600
                  </div>
                  <div className="text-sm text-gray-400">
                    {thresholdProgress.toFixed(1)}%
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${thresholdProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Current year earnings: ${yearlyPaid.toFixed(2)} / $600.00
                </p>
              </div>
            )}

            {/* Pending Payouts Alert */}
            {summary?.pending_requests_count > 0 && (
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="font-semibold text-blue-400">
                      {summary.pending_requests_count} Pending Payout Request{summary.pending_requests_count > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-300">
                      Your payout request{summary.pending_requests_count > 1 ? 's are' : ' is'} being reviewed by our team.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Monthly Breakdown */}
            {monthlyBreakdown.length > 0 && (
              <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  Monthly Earnings Breakdown
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400">
                        <th className="text-left py-2">Month</th>
                        <th className="text-right py-2">Coins Earned</th>
                        <th className="text-right py-2">Gifts Received</th>
                        <th className="text-right py-2">Unique Gifters</th>
                        <th className="text-right py-2">Paid Coins</th>
                        <th className="text-right py-2">Free Coins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyBreakdown.map((month, idx) => (
                        <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="py-2">
                            {new Date(month.month).toLocaleDateString('en-US', { 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </td>
                          <td className="text-right py-2 font-semibold text-green-400">
                            {month.coins_earned_from_gifts?.toLocaleString() || 0}
                          </td>
                          <td className="text-right py-2 text-gray-300">
                            {month.gift_count || 0}
                          </td>
                          <td className="text-right py-2 text-gray-300">
                            {month.unique_gifters || 0}
                          </td>
                          <td className="text-right py-2 text-yellow-400">
                            {month.paid_coins_earned?.toLocaleString() || 0}
                          </td>
                          <td className="text-right py-2 text-blue-400">
                            {month.free_coins_earned?.toLocaleString() || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payout History */}
            {payoutHistory.length > 0 && (
              <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
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
                      {payoutHistory.map((payout) => (
                        <tr key={payout.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="py-2 text-gray-300">
                            {new Date(payout.created_at).toLocaleDateString()}
                          </td>
                          <td className="text-right py-2 text-gray-300">
                            {payout.coins_redeemed?.toLocaleString() || 0}
                          </td>
                          <td className="text-right py-2 font-semibold text-green-400">
                            ${payout.cash_amount?.toFixed(2) || '0.00'}
                          </td>
                          <td className="text-center py-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              payout.status === 'paid' ? 'bg-green-900 text-green-300' :
                              payout.status === 'approved' ? 'bg-blue-900 text-blue-300' :
                              payout.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                              'bg-red-900 text-red-300'
                            }`}>
                              {payout.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 text-gray-400 text-sm">
                            {payout.processed_at 
                              ? new Date(payout.processed_at).toLocaleDateString()
                              : '—'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
              <h2 className="text-xl font-bold mb-4">Recent Earnings Transactions</h2>
              
              {earnings.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No earnings transactions yet.</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {earnings.map((earning, index) => (
                    <div 
                      key={index}
                      className="flex justify-between items-center p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition"
                    >
                      <div>
                        <p className="text-sm text-gray-400">
                          {new Date(earning.created_at).toLocaleDateString()} {new Date(earning.created_at).toLocaleTimeString()}
                        </p>
                        {earning.type && (
                          <p className="text-xs text-gray-500 mt-1 capitalize">{earning.type.replace('_', ' ')}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-semibold">
                          +{earning.amount?.toLocaleString() || 0} coins
                        </p>
                        {earning.metadata?.usd_value && (
                          <p className="text-xs text-gray-500 mt-1">
                            ${(earning.metadata.usd_value / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
