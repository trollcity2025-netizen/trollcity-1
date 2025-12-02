import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Download, Filter, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface ReferralData {
  recruiter_id: string
  recruiter_username: string
  referred_user_id: string
  referred_username: string
  month: string
  coins_earned: number
  bonus_paid: number
  status: 'paid' | 'pending' | 'not_eligible'
}

export default function ReferralBonusPanel() {
  const [referrals, setReferrals] = useState<ReferralData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [months, setMonths] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Get all unique months from bonuses
      const { data: bonusesData } = await supabase
        .from('referral_monthly_bonus')
        .select('month')
        .order('month', { ascending: false })

      const uniqueMonths = Array.from(
        new Set((bonusesData || []).map((b: any) => b.month))
      ) as string[]
      setMonths(uniqueMonths)

      // Set current month as default
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      if (!selectedMonth) {
        setSelectedMonth(currentMonth)
      }

      await loadReferralData(selectedMonth || currentMonth)
    } catch (error: any) {
      console.error('Error loading data:', error)
      toast.error('Failed to load referral data')
    } finally {
      setLoading(false)
    }
  }

  const loadReferralData = async (month: string) => {
    try {
      // Get all referrals with user info
      const { data: allReferrals, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          recruiter_id,
          referred_user_id,
          recruiter:user_profiles!referrals_recruiter_id_fkey (
            username
          ),
          referred_user:user_profiles!referrals_referred_user_id_fkey (
            username
          )
        `)

      if (referralsError) throw referralsError

      // Get bonuses for selected month
      const { data: bonusesData, error: bonusesError } = await supabase
        .from('referral_monthly_bonus')
        .select('*')
        .eq('month', month)

      if (bonusesError) throw bonusesError

      // Build referral data with stats
      const referralDataPromises = (allReferrals || []).map(async (ref: any) => {
        const recruiter = Array.isArray(ref.recruiter) ? ref.recruiter[0] : ref.recruiter
        const referredUser = Array.isArray(ref.referred_user) ? ref.referred_user[0] : ref.referred_user

        // Get monthly coins earned
        const { data: coinsData } = await supabase.rpc('get_user_monthly_coins_earned', {
          p_user_id: ref.referred_user_id,
          p_month: month
        })

        const monthlyCoins = Number(coinsData) || 0
        const isEligible = monthlyCoins >= 40000

        // Check if bonus already paid
        const existingBonus = (bonusesData || []).find(
          (b: any) => b.referred_user_id === ref.referred_user_id && b.month === month
        )

        return {
          recruiter_id: ref.recruiter_id,
          recruiter_username: recruiter?.username || 'Unknown',
          referred_user_id: ref.referred_user_id,
          referred_username: referredUser?.username || 'Unknown',
          month,
          coins_earned: monthlyCoins,
          bonus_paid: existingBonus?.bonus_paid_coins || 0,
          status: existingBonus ? 'paid' : (isEligible ? 'pending' : 'not_eligible') as 'paid' | 'pending' | 'not_eligible'
        }
      })

      const referralData = await Promise.all(referralDataPromises)
      setReferrals(referralData)
    } catch (error: any) {
      console.error('Error loading referral data:', error)
      toast.error('Failed to load referral data')
    }
  }

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    loadReferralData(month)
  }

  const exportToCSV = () => {
    const headers = ['Recruiter', 'Referred User', 'Month', 'Coins Earned', 'Bonus Paid', 'Status']
    const rows = referrals.map(r => [
      r.recruiter_username,
      r.referred_username,
      r.month,
      r.coins_earned.toString(),
      r.bonus_paid.toString(),
      r.status
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `referral-bonuses-${selectedMonth}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast.success('CSV exported successfully')
  }

  const processBonuses = async () => {
    try {
      const api = (await import('../../lib/api')).default
      const response = await api.post('/process-referral-bonuses', {})
      
      if (response.success) {
        toast.success(`Processed ${response.bonusesProcessed} bonuses, paid ${response.totalBonusPaid} coins`)
        loadData()
      } else {
        toast.error(response.error || 'Failed to process bonuses')
      }
    } catch (error: any) {
      console.error('Error processing bonuses:', error)
      toast.error('Failed to process bonuses')
    }
  }

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-')
    const date = new Date(parseInt(year), parseInt(monthNum) - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const totalBonuses = referrals.reduce((sum, r) => sum + r.bonus_paid, 0)
  const pendingCount = referrals.filter(r => r.status === 'pending').length
  const paidCount = referrals.filter(r => r.status === 'paid').length

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading referral data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Referral Bonus Management</h2>
          <p className="text-gray-400 text-sm">Track and manage Troll Empire Partner Program bonuses</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={processBonuses}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Process Bonuses
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <p className="text-sm text-gray-400">Total Referrals</p>
          <p className="text-2xl font-bold">{referrals.length}</p>
        </div>
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <p className="text-sm text-gray-400">Pending Bonuses</p>
          <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
        </div>
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <p className="text-sm text-gray-400">Paid Bonuses</p>
          <p className="text-2xl font-bold text-green-400">{paidCount}</p>
        </div>
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <p className="text-sm text-gray-400">Total Paid</p>
          <p className="text-2xl font-bold text-purple-400">{totalBonuses.toLocaleString()}</p>
        </div>
      </div>

      {/* Month Filter */}
      <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-gray-400" />
          <label className="text-sm font-semibold">Filter by Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg px-4 py-2 text-sm"
          >
            {months.map(month => (
              <option key={month} value={month}>{formatMonth(month)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0A0814]">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Recruiter</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Referred User</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Coins Earned</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Bonus Eligible</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Bonus Paid</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No referrals found for selected month
                  </td>
                </tr>
              ) : (
                referrals.map((ref, idx) => (
                  <tr key={`${ref.recruiter_id}-${ref.referred_user_id}`} className="border-t border-[#2C2C2C] hover:bg-[#1A1A1A]">
                    <td className="py-3 px-4">{ref.recruiter_username}</td>
                    <td className="py-3 px-4">{ref.referred_username}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold">{ref.coins_earned.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4">
                      {ref.coins_earned >= 40000 ? (
                        <span className="text-green-400">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ref.bonus_paid > 0 ? (
                        <span className="text-yellow-400 font-semibold">
                          {ref.bonus_paid.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ref.status === 'paid' && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          Paid
                        </span>
                      )}
                      {ref.status === 'pending' && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                          Pending
                        </span>
                      )}
                      {ref.status === 'not_eligible' && (
                        <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
                          Not Eligible
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

