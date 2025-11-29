import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Loader } from 'lucide-react'

interface Creator {
  id: string
  username: string
  total_earned_usd: number
  lifetime_payout_total: number
  last_payout_at?: string
}

const AdminEarningsDashboard: React.FC = () => {
  const { profile } = useAuthStore()
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.role !== 'admin') {
      toast.error('Unauthorized')
      return
    }

    const fetchEarnings = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, total_earned_usd, lifetime_payout_total, last_payout_at')
        .order('total_earned_usd', { ascending: false })

      if (error) {
        toast.error('Failed to load creator data')
        return
      }

      setCreators(data || [])
      setLoading(false)
    }

    fetchEarnings()
  }, [profile])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader className="animate-spin" /> Loading...
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-slate-900 text-white">
      <h1 className="text-3xl font-bold mb-6">Creator Earnings Dashboard</h1>

      <table className="w-full text-sm border-collapse border border-slate-800">
        <thead>
          <tr className="bg-slate-800 text-left">
            <th className="p-3">Creator</th>
            <th className="p-3">Total Earned ($)</th>
            <th className="p-3">Payouts Sent</th>
            <th className="p-3">Threshold Status</th>
            <th className="p-3">Last Payout</th>
          </tr>
        </thead>
        <tbody>
          {creators.map((user) => {
            const nearThreshold =
              user.total_earned_usd >= 500 && user.total_earned_usd < 600
                ? '🔶 Nearing $600'
                : user.total_earned_usd >= 600
                ? '🔥 Over $600'
                : '🟢 Normal'

            return (
              <tr key={user.id} className="border-b border-slate-700 hover:bg-slate-800">
                <td className="p-3">{user.username}</td>
                <td className="p-3">${user.total_earned_usd.toFixed(2)}</td>
                <td className="p-3">${user.lifetime_payout_total.toFixed(2)}</td>
                <td className="p-3">{nearThreshold}</td>
                <td className="p-3">
                  {user.last_payout_at
                    ? new Date(user.last_payout_at).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default AdminEarningsDashboard