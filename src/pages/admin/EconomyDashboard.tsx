import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { DollarSign, Coins, Users, TrendingUp, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export default function EconomyDashboard() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [monthly, setMonthly] = useState<any[]>([])
  const [topBuyers, setTopBuyers] = useState<any[]>([])
  const [over600, setOver600] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Check admin access
  useEffect(() => {
    if (profile && !['admin', 'troll_officer'].includes(profile.role) && !profile.is_admin) {
      toast.error('Access denied')
      navigate('/')
    }
  }, [profile, navigate])

  useEffect(() => {
    let coinPurchasesChannel: any = null

    const load = async () => {
      if (!profile || !['admin', 'troll_officer'].includes(profile.role)) return

      setLoading(true)
      try {
        // Fetch real data from coin_transactions (Source of Truth)
        // This ensures we catch all purchases even if the views are outdated
        const { data: transactions, error: txError } = await supabase
          .from('coin_transactions')
          .select('amount, created_at, user_id, type, metadata, platform_profit')
          .in('type', ['store_purchase', 'paypal_purchase', 'purchase'])
          .order('created_at', { ascending: false })

        if (txError) throw txError

        // Process transactions for Monthly Revenue
        const monthlyData: Record<string, { total_usd: number; total_coins: number; purchase_count: number }> = {}
        const buyersData: Record<string, { username: string; total_spent_usd: number; total_coins_bought: number; transaction_count: number }> = {}

        // Fetch user profiles for buyers to get usernames
        const userIds = [...new Set((transactions || []).map(t => t.user_id).filter(Boolean))]
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', userIds)
        
        const userMap = new Map(profiles?.map(p => [p.id, p.username]) || [])

        transactions?.forEach(tx => {
          const date = new Date(tx.created_at)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01` // YYYY-MM-01 format
          
          // Determine USD amount - check multiple sources
          let usdAmount = 0
          
          // 1. Check platform_profit first (if it exists)
          if (tx.platform_profit) {
            usdAmount = Number(tx.platform_profit)
          }
          // 2. Check metadata.amount_usd (from Square/charge-stored-card)
          else if (tx.metadata?.amount_usd) {
            usdAmount = Number(tx.metadata.amount_usd)
          }
          // 3. Check metadata.amount_paid (from PayPal)
          else if (tx.metadata?.amount_paid) {
            usdAmount = Number(tx.metadata.amount_paid)
          }
          // 4. Check metadata.price (fallback)
          else if (tx.metadata?.price) {
            usdAmount = Number(tx.metadata.price)
          }
          
          // If still 0, maybe it's in the amount field (but amount is usually coins)
          // Store purchases usually have negative coins? No, they grant positive coins.
          // Let's check coin amount.
          const coinAmount = Number(tx.amount || 0) // Usually coins granted
          
          // Aggregating Monthly
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { total_usd: 0, total_coins: 0, purchase_count: 0 }
          }
          monthlyData[monthKey].total_usd += usdAmount
          monthlyData[monthKey].total_coins += coinAmount
          monthlyData[monthKey].purchase_count += 1

          // Aggregating Top Buyers
          if (tx.user_id) {
            if (!buyersData[tx.user_id]) {
              buyersData[tx.user_id] = { 
                username: userMap.get(tx.user_id) || 'Unknown', 
                total_spent_usd: 0, 
                total_coins_bought: 0, 
                transaction_count: 0 
              }
            }
            buyersData[tx.user_id].total_spent_usd += usdAmount
            buyersData[tx.user_id].total_coins_bought += coinAmount
            buyersData[tx.user_id].transaction_count += 1
          }
        })

        // Convert to arrays
        const monthlyArray = Object.entries(monthlyData).map(([month, data]) => ({
          month,
          ...data
        })).sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())

        const buyersArray = Object.values(buyersData).sort((a, b) => b.total_spent_usd - a.total_spent_usd).slice(0, 20)

        // Load creators over $600 threshold (keep existing logic)
        const { data: o600, error: o600Error } = await supabase
          .from('creators_over_600')
          .select('*')

        if (o600Error) {
          console.warn('Error loading over 600 view:', o600Error)
        }

        setMonthly(monthlyArray)
        setTopBuyers(buyersArray)
        setOver600(o600 || [])
      } catch (error: any) {
        console.error('Error loading economy data:', error)
        toast.error('Failed to load economy data')
      } finally {
        setLoading(false)
      }
    }

    load()

    // Subscribe to new coin purchases in real-time
    coinPurchasesChannel = supabase
      .channel('economy-coin-purchases')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coin_transactions', filter: "type=eq.store_purchase" }, () => {
        console.log('📊 New store purchase detected in Economy Dashboard')
        load()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coin_transactions', filter: "type=eq.paypal_purchase" }, () => {
        console.log('📊 New PayPal purchase detected in Economy Dashboard')
        load()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coin_transactions', filter: "type=eq.purchase" }, () => {
        console.log('📊 New purchase detected in Economy Dashboard')
        load()
      })
      .subscribe()

    return () => {
      if (coinPurchasesChannel) {
        supabase.removeChannel(coinPurchasesChannel)
      }
    }
  }, [profile])

  if (!profile || !['admin', 'troll_officer'].includes(profile.role)) {
    return null
  }

  if (loading) {
    return (
      <div className="p-6 text-slate-300 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p>Loading economy data…</p>
        </div>
      </div>
    )
  }

  const totalUsd = monthly.reduce((s, m) => s + Number(m.total_usd || 0), 0)
  const totalCoins = monthly.reduce((s, m) => s + Number(m.total_coins || 0), 0)
  const totalPurchases = monthly.reduce((s, m) => s + Number(m.purchase_count || 0), 0)

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0A0814] text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text">
          Troll City Economy
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          icon={DollarSign} 
          label="Lifetime Revenue" 
          value={`$${totalUsd.toFixed(2)}`}
          color="text-green-400"
        />
        <StatCard 
          icon={Coins} 
          label="Coins Sold" 
          value={totalCoins.toLocaleString()}
          color="text-yellow-400"
        />
        <StatCard 
          icon={Users} 
          label="Total Purchases" 
          value={totalPurchases.toLocaleString()}
          color="text-blue-400"
        />
        <StatCard 
          icon={TrendingUp} 
          label="Top Buyers" 
          value={topBuyers.length}
          color="text-purple-400"
        />
      </div>

      {/* IRS 1099 Threshold Alert */}
      {over600.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-semibold text-red-400">
              Creators Over $600 This Year (IRS 1099 Required)
            </h3>
          </div>
          <p className="text-sm text-gray-300 mb-3">
            These creators have received $600+ in payouts and require tax forms (W-9, 1099-NEC).
          </p>
          <div className="space-y-2">
            {over600.slice(0, 5).map((creator) => (
              <div key={`${creator.user_id}-${creator.year}`} className="flex justify-between items-center bg-black/30 rounded p-2">
                <span className="font-medium">@{creator.username}</span>
                <span className="text-red-400 font-semibold">
                  ${Number(creator.total_payout_usd).toFixed(2)} ({creator.year})
                </span>
              </div>
            ))}
            {over600.length > 5 && (
              <p className="text-xs text-gray-400">+ {over600.length - 5} more creators</p>
            )}
          </div>
        </div>
      )}

      {/* Revenue by Month */}
      <section className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#2C2C2C]">
          <h2 className="text-lg font-semibold text-slate-100">Revenue by Month</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1A1A1A]">
              <tr>
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">Month</th>
                <th className="px-4 py-3 text-right text-gray-300 font-semibold">USD</th>
                <th className="px-4 py-3 text-right text-gray-300 font-semibold">Coins</th>
                <th className="px-4 py-3 text-right text-gray-300 font-semibold">Purchases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C2C]">
              {monthly.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No revenue data yet
                  </td>
                </tr>
              ) : (
                monthly.map((m) => (
                  <tr key={m.month} className="hover:bg-[#1A1A1A]">
                    <td className="px-4 py-3">
                      {new Date(m.month).toLocaleDateString(undefined, { 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">
                      ${Number(m.total_usd || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-400">
                      {Number(m.total_coins || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {m.purchase_count || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top Buyers */}
      <section className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#2C2C2C]">
          <h2 className="text-lg font-semibold text-slate-100">Top Buyers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1A1A1A]">
              <tr>
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">User</th>
                <th className="px-4 py-3 text-right text-gray-300 font-semibold">USD Spent</th>
                <th className="px-4 py-3 text-right text-gray-300 font-semibold">Coins Bought</th>
                <th className="px-4 py-3 text-right text-gray-300 font-semibold">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C2C]">
              {topBuyers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No buyers yet
                  </td>
                </tr>
              ) : (
                topBuyers.map((u, idx) => (
                  <tr key={u.user_id} className="hover:bg-[#1A1A1A]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">#{idx + 1}</span>
                        <span className="font-medium">@{u.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">
                      ${Number(u.total_spent_usd || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-400">
                      {Number(u.total_coins_bought || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {u.transaction_count || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color = 'text-slate-50' }: any) {
  return (
    <div className="rounded-2xl bg-[#141414] border border-[#2C2C2C] px-4 py-3 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-[#1A1A1A]">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className="text-xs text-gray-400 uppercase">{label}</div>
        <div className={`text-lg font-semibold ${color}`}>{value}</div>
      </div>
    </div>
  )
}

