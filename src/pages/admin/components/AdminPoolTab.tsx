import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { PieChart } from 'lucide-react'

const ADMIN_POOL_COINS_PER_DOLLAR = 222.3

type AdminPoolTransaction = {
  id: string
  transaction_id: string
  user_id: string
  cashout_amount: number
  admin_fee: number
  admin_profit: number
  transaction_type: string
  created_at: string
  source_details: any
}

type UserLite = {
  id: string
  username: string
}

export default function AdminPoolTab() {
  const { user } = useAuthStore()
  const [transactions, setTransactions] = useState<AdminPoolTransaction[]>([])
  const [users, setUsers] = useState<Record<string, UserLite>>({})
  const [loading, setLoading] = useState(false)
  const [poolCoins, setPoolCoins] = useState<number | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('admin_pool_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)

        if (error && error.code !== 'PGRST116') throw error
        const rows = (data || []) as AdminPoolTransaction[]
        setTransactions(rows)

        const ids = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)))
        if (ids.length) {
          const { data: profiles, error: pErr } = await supabase
            .from('user_profiles')
            .select('id, username')
            .in('id', ids)
          if (pErr) throw pErr
          const map: Record<string, UserLite> = {}
          ;(profiles || []).forEach((u: any) => { map[u.id] = { id: u.id, username: u.username } })
          setUsers(map)
        }

        const { data: poolRow, error: poolError } = await supabase
          .from('admin_pool')
          .select('trollcoins_balance')
          .maybeSingle()
        if (poolError && (poolError as any).code !== 'PGRST116') throw poolError
        if (poolRow && typeof (poolRow as any).trollcoins_balance !== 'undefined') {
          setPoolCoins(Number((poolRow as any).trollcoins_balance || 0))
        } else {
          setPoolCoins(null)
        }
      } catch (err: any) {
        console.error('Failed to load admin pool:', err)
        toast.error('Failed to load admin pool')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  const { rows, totalProfit, totalFees } = useMemo(() => {
    let profit = 0
    let fees = 0
    const processed = transactions.map(t => {
      profit += Number(t.admin_profit || 0)
      fees += Number(t.admin_fee || 0)
      return {
        ...t,
        username: users[t.user_id]?.username || t.user_id || 'Unknown',
        date: new Date(t.created_at).toLocaleString(),
      }
    })
    return { rows: processed, totalProfit: profit, totalFees: fees }
  }, [transactions, users])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-3">
          <PieChart className="w-6 h-6 text-troll-green" />
          Admin Pool
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#121212] border border-troll-green/30 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm mb-1">Total Admin Profit</h3>
            <div className="text-3xl font-bold text-troll-green">${totalProfit.toFixed(2)}</div>
          </div>
          <div className="bg-[#121212] border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm mb-1">Total Admin Fees Collected</h3>
            <div className="text-3xl font-bold text-blue-400">${totalFees.toFixed(2)}</div>
          </div>
          <div className="bg-[#121212] border border-emerald-500/30 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm mb-1">Admin Pool Coins</h3>
            <div className="text-3xl font-bold text-emerald-300">
              {poolCoins === null ? '—' : poolCoins.toLocaleString()}
            </div>
          </div>
          <div className="bg-[#121212] border border-purple-500/30 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm mb-1">Admin Pool Cash Value</h3>
            <div className="text-3xl font-bold text-purple-300">
              {poolCoins === null ? '—' : `$${(poolCoins / ADMIN_POOL_COINS_PER_DOLLAR).toFixed(2)}`}
            </div>
          </div>
        </div>

        <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl p-4">
          {loading ? (
            <div className="text-gray-300">Loading admin pool transactions...</div>
          ) : rows.length === 0 ? (
            <div className="text-gray-400">No transactions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-300 border-b border-[#2C2C2C]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Cashout Amount</th>
                    <th className="py-3 px-4">Admin Fee</th>
                    <th className="py-3 px-4">Admin Profit</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-[#2C2C2C]/50 hover:bg-white/5">
                      <td className="py-3 px-4">{r.date}</td>
                      <td className="py-3 px-4 font-medium text-blue-300">@{r.username}</td>
                      <td className="py-3 px-4 capitalize">{r.transaction_type}</td>
                      <td className="py-3 px-4">${Number(r.cashout_amount).toFixed(2)}</td>
                      <td className="py-3 px-4 text-yellow-400">${Number(r.admin_fee).toFixed(2)}</td>
                      <td className="py-3 px-4 text-troll-green font-bold">${Number(r.admin_profit).toFixed(2)}</td>
                      <td className="py-3 px-4 text-xs text-gray-500 max-w-xs truncate">
                        {JSON.stringify(r.source_details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
