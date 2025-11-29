import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Loader } from 'lucide-react'
import { toast } from 'sonner'

interface Transaction {
  id: string
  coins: number
  usd_value: number
  transaction_type: string
  created_at: string
}

const MyEarnings: React.FC = () => {
  const { user, profile } = useAuthStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('coin_transactions')
        .select('id, amount, metadata, type, created_at')
        .eq('user_id', user.id)
        .in('type', ['gift_receive', 'cashout'])
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Failed to load earnings history')
        return
      }

      // Transform data to match interface
      const transformedData = (data || []).map(tx => ({
        id: tx.id,
        coins: tx.amount,
        usd_value: tx.metadata?.usd_value || 0,
        transaction_type: tx.type,
        created_at: tx.created_at
      }))

      setTransactions(transformedData)
      setLoading(false)
    }

    fetchTransactions()
  }, [user])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader className="animate-spin" /> Loading...
      </div>
    )
  }

  const totalEarned = transactions.reduce((sum, t) => sum + t.usd_value, 0)
  const giftIncome = transactions
    .filter(t => t.transaction_type === 'gift_receive')
    .reduce((sum, t) => sum + t.usd_value, 0)
  const pendingCashouts = 0 // you can build later

  return (
    <div className="min-h-screen p-6 bg-slate-900 text-white">
      <h1 className="text-2xl font-bold mb-4">My Earnings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-sm text-slate-400">Lifetime Earned</p>
          <p className="text-xl font-bold">${totalEarned.toFixed(2)}</p>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-sm text-slate-400">Pending Cashouts</p>
          <p className="text-xl font-bold">${pendingCashouts.toFixed(2)}</p>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-sm text-slate-400">Gift Income</p>
          <p className="text-xl font-bold">${giftIncome.toFixed(2)}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-2">Transaction History</h2>
      <table className="w-full text-sm border-collapse border border-slate-800">
        <thead>
          <tr className="bg-slate-800 text-left">
            <th className="p-2">Type</th>
            <th className="p-2">Coins</th>
            <th className="p-2">USD Value</th>
            <th className="p-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <tr key={tx.id} className="border-b border-slate-700">
              <td className="p-2 capitalize">{tx.transaction_type.replace('_', ' ')}</td>
              <td className="p-2">{tx.coins}</td>
              <td className="p-2">${tx.usd_value.toFixed(2)}</td>
              <td className="p-2">
                {new Date(tx.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default MyEarnings