import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Users, Coins, TrendingUp, CheckCircle2, XCircle, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface Referral {
  id: string
  referred_user_id: string
  created_at: string
  referred_user: {
    username: string
    avatar_url: string
  }
}

interface MonthlyBonus {
  id: string
  referred_user_id: string
  month: string
  coins_earned: number
  bonus_paid_coins: number
  created_at: string
  referred_user: {
    username: string
  }
}

interface ReferralStats {
  referred_user_id: string
  username: string
  avatar_url: string
  monthly_coins: number
  is_eligible: boolean
  bonus_paid: number
  bonus_status: 'paid' | 'not_eligible' | 'pending'
}

export default function EmpirePartnerDashboard() {
  const { profile, user } = useAuthStore()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [bonuses, setBonuses] = useState<MonthlyBonus[]>([])
  const [stats, setStats] = useState<ReferralStats[]>([])
  const [loading, setLoading] = useState(true)
  const [referralLink, setReferralLink] = useState('')
  const [totalEarned, setTotalEarned] = useState(0)

  useEffect(() => {
    if (user?.id && profile) {
      // Check if user is an approved Empire Partner
      if (profile.empire_role !== 'partner') {
        // Don't redirect, just show apply button
        return
      }
      
      loadData()
      // Generate referral link
      const baseUrl = window.location.origin
      setReferralLink(`${baseUrl}/signup?ref=${user.id}`)
    }
  }, [user?.id, profile?.empire_role])
  
  // Show apply button if not approved
  if (profile?.empire_role !== 'partner') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-4xl font-bold mb-4">Empire Partner Program</h1>
          <p className="text-gray-400 mb-8">You must be an approved Empire Partner to access the referral dashboard.</p>
          <a
            href="/empire-partner/apply"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold"
          >
            Apply Now
          </a>
        </div>
      </div>
    )
  }

  const loadData = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      // Load referrals
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          id,
          referred_user_id,
          created_at,
          referred_user:user_profiles!referrals_referred_user_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq('recruiter_id', user.id)
        .order('created_at', { ascending: false })

      if (referralsError) throw referralsError

      // Transform referrals data
      const transformedReferrals = (referralsData || []).map((r: any) => ({
        id: r.id,
        referred_user_id: r.referred_user_id,
        created_at: r.created_at,
        referred_user: Array.isArray(r.referred_user) ? r.referred_user[0] : r.referred_user
      }))

      setReferrals(transformedReferrals)

      // Load monthly bonuses
      const { data: bonusesData, error: bonusesError } = await supabase
        .from('referral_monthly_bonus')
        .select(`
          id,
          referred_user_id,
          month,
          coins_earned,
          bonus_paid_coins,
          created_at,
          referred_user:user_profiles!referral_monthly_bonus_referred_user_id_fkey (
            username
          )
        `)
        .eq('recruiter_id', user.id)
        .order('created_at', { ascending: false })

      if (bonusesError) throw bonusesError

      const transformedBonuses = (bonusesData || []).map((b: any) => ({
        id: b.id,
        referred_user_id: b.referred_user_id,
        month: b.month,
        coins_earned: b.coins_earned,
        bonus_paid_coins: b.bonus_paid_coins,
        created_at: b.created_at,
        referred_user: Array.isArray(b.referred_user) ? b.referred_user[0] : b.referred_user
      }))

      setBonuses(transformedBonuses)

      // Calculate total earned
      const total = transformedBonuses.reduce((sum, b) => sum + (b.bonus_paid_coins || 0), 0)
      setTotalEarned(total)

      // Load current month stats for each referral
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const statsPromises = transformedReferrals.map(async (ref: Referral) => {
        // Get monthly coins earned
        const { data: coinsData } = await supabase.rpc('get_user_monthly_coins_earned', {
          p_user_id: ref.referred_user_id,
          p_month: currentMonth
        })

        const monthlyCoins = Number(coinsData) || 0
        const isEligible = monthlyCoins >= 40000

        // Check if bonus already paid this month
        const existingBonus = transformedBonuses.find(
          b => b.referred_user_id === ref.referred_user_id && b.month === currentMonth
        )

        return {
          referred_user_id: ref.referred_user_id,
          username: ref.referred_user?.username || 'Unknown',
          avatar_url: ref.referred_user?.avatar_url || '',
          monthly_coins: monthlyCoins,
          is_eligible: isEligible,
          bonus_paid: existingBonus?.bonus_paid_coins || 0,
          bonus_status: existingBonus ? 'paid' : (isEligible ? 'pending' : 'not_eligible')
        }
      })

      const statsData = await Promise.all(statsPromises)
      setStats(statsData)
    } catch (error: any) {
      console.error('Error loading referral data:', error)
      toast.error('Failed to load referral data')
    } finally {
      setLoading(false)
    }
  }

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink)
    toast.success('Referral link copied!')
  }

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-')
    const date = new Date(parseInt(year), parseInt(monthNum) - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading referral data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Troll Empire Partner Program
          </h1>
          <p className="text-gray-400">Earn 5% bonus when your referrals earn 40,000+ coins per month</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-semibold">Total Referrals</h3>
            </div>
            <p className="text-3xl font-bold">{referrals.length}</p>
            <p className="text-sm text-gray-400 mt-2">Users you've recruited</p>
          </div>

          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              <h3 className="text-lg font-semibold">Total Earned</h3>
            </div>
            <p className="text-3xl font-bold">{totalEarned.toLocaleString()}</p>
            <p className="text-sm text-gray-400 mt-2">Paid coins from bonuses</p>
          </div>

          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold">Active This Month</h3>
            </div>
            <p className="text-3xl font-bold">
              {stats.filter(s => s.monthly_coins > 0).length}
            </p>
            <p className="text-sm text-gray-400 mt-2">Referrals earning coins</p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Referral Link</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 bg-[#0A0814] border border-[#2C2C2C] rounded-lg px-4 py-2 text-sm"
            />
            <button
              onClick={copyReferralLink}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Share this link to recruit new users. You'll earn 5% of their monthly earnings when they reach 40,000+ coins.
          </p>
        </div>

        {/* Referrals Table */}
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Referrals</h2>
          {stats.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No referrals yet. Share your referral link to start earning!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2C2C2C]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Coins Earned (This Month)</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Bonus Eligible</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Bonus Paid</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat) => (
                    <tr key={stat.referred_user_id} className="border-b border-[#2C2C2C] hover:bg-[#1A1A1A]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={stat.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${stat.username}`}
                            alt={stat.username}
                            className="w-10 h-10 rounded-full"
                          />
                          <span className="font-medium">{stat.username}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold">{stat.monthly_coins.toLocaleString()}</span>
                        <span className="text-gray-400 text-sm ml-2">coins</span>
                      </td>
                      <td className="py-3 px-4">
                        {stat.is_eligible ? (
                          <span className="text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            {stat.monthly_coins > 0 
                              ? `${(40000 - stat.monthly_coins).toLocaleString()} more needed`
                              : 'Not yet'
                            }
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {stat.bonus_paid > 0 ? (
                          <span className="text-yellow-400 font-semibold">
                            {stat.bonus_paid.toLocaleString()} coins
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {stat.bonus_status === 'paid' && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                            Paid
                          </span>
                        )}
                        {stat.bonus_status === 'pending' && (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                            Pending
                          </span>
                        )}
                        {stat.bonus_status === 'not_eligible' && (
                          <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
                            Not Eligible
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bonus History */}
        {bonuses.length > 0 && (
          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Bonus History</h2>
            <div className="space-y-3">
              {bonuses.map((bonus) => (
                <div
                  key={bonus.id}
                  className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{bonus.referred_user?.username || 'Unknown User'}</p>
                    <p className="text-sm text-gray-400">
                      {formatMonth(bonus.month)} • {bonus.coins_earned.toLocaleString()} coins earned
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-yellow-400">
                      +{bonus.bonus_paid_coins.toLocaleString()} coins
                    </p>
                    <p className="text-xs text-gray-400">5% bonus</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

