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
    if (profile && !['admin', 'troll_officer'].includes(profile.role)) {
      toast.error('Access denied')
      navigate('/')
    }
  }, [profile, navigate])

  useEffect(() => {
    const load = async () => {
      if (!profile || !['admin', 'troll_officer'].includes(profile.role)) return

      setLoading(true)
      try {
        // Load monthly revenue
        const { data: m, error: mError } = await supabase
          .from('admin_coin_revenue')
          .select('*')
          .order('month', { ascending: false })
          .limit(24) // Last 24 months

        if (mError) throw mError

        // Load top buyers
        const { data: t, error: tError } = await supabase
          .from('admin_top_buyers')
          .select('*')
          .limit(20)

        if (tError) throw tError

        // Load creators over $600 threshold
        const { data: o600, error: o600Error } = await supabase
          .from('creators_over_600')
          .select('*')

        if (o600Error) {
          console.warn('Error loading over 600 view:', o600Error)
          // View might not exist yet, continue without it
        }

        setMonthly(m || [])
        setTopBuyers(t || [])
        setOver600(o600 || [])
      } catch (error: any) {
        console.error('Error loading economy data:', error)
        toast.error('Failed to load economy data')
      } finally {
        setLoading(false)
      }
    }

    load()
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

