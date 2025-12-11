import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Users, Coins, TrendingUp, CheckCircle2, XCircle, Copy, ExternalLink, Clock, Target } from 'lucide-react'
import { toast } from 'sonner'

interface Referral {
  id: string
  referrer_id: string
  referred_user_id: string
  referred_at: string
  reward_status: 'pending' | 'completed' | 'failed'
  deadline: string
  referred_user: {
    username: string
    avatar_url: string
    paid_coin_balance: number
  }
}

interface ReferralReward {
  id: string
  referrer_id: string
  referred_user_id: string
  coins_awarded: number
  rewarded_at: string
}

interface ReferralStats {
  totalReferrals: number
  completedReferrals: number
  pendingReferrals: number
  failedReferrals: number
  totalCoinsEarned: number
}

export default function EmpirePartnerDashboard() {
  const { profile, user } = useAuthStore()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [rewards, setRewards] = useState<ReferralReward[]>([])
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [referralLink, setReferralLink] = useState('')

  useEffect(() => {
    if (user?.id && profile) {
      // Check if user is an approved Empire Partner
      if (profile.empire_partner !== true && profile.partner_status !== 'approved' && profile.role !== 'empire_partner') {
        // Don't redirect, just show apply button
        return
      }

      loadData()
      // Generate referral link
      const baseUrl = window.location.origin
      setReferralLink(`${baseUrl}/signup?ref=${user.id}`)
    }
  }, [user?.id, profile])
  
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
      // Load referrals with user data
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          id,
          referrer_id,
          referred_user_id,
          referred_at,
          reward_status,
          deadline,
          referred_user:user_profiles!referrals_referred_user_id_fkey (
            username,
            avatar_url,
            paid_coin_balance
          )
        `)
        .eq('referrer_id', user.id)
        .order('referred_at', { ascending: false })

      if (referralsError) throw referralsError

      // Transform referrals data
      const transformedReferrals = (referralsData || []).map((r: any) => ({
        id: r.id,
        referrer_id: r.referrer_id,
        referred_user_id: r.referred_user_id,
        referred_at: r.referred_at,
        reward_status: r.reward_status,
        deadline: r.deadline,
        referred_user: Array.isArray(r.referred_user) ? r.referred_user[0] : r.referred_user
      }))

      setReferrals(transformedReferrals)

      // Load rewards
      const { data: rewardsData, error: rewardsError } = await supabase
        .from('empire_partner_rewards')
        .select('*')
        .eq('referrer_id', user.id)
        .order('rewarded_at', { ascending: false })

      if (rewardsError) throw rewardsError

      setRewards(rewardsData || [])

      // Calculate stats
      const totalReferrals = transformedReferrals.length
      const completedReferrals = transformedReferrals.filter(r => r.reward_status === 'completed').length
      const pendingReferrals = transformedReferrals.filter(r => r.reward_status === 'pending').length
      const failedReferrals = transformedReferrals.filter(r => r.reward_status === 'failed').length
      const totalCoinsEarned = (rewardsData || []).reduce((sum, reward) => sum + reward.coins_awarded, 0)

      setStats({
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        failedReferrals,
        totalCoinsEarned
      })

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
          <p className="text-gray-400">Earn 10,000 coins when your referrals reach 40,000 paid coins within 21 days</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-semibold">Total Referrals</h3>
            </div>
            <p className="text-3xl font-bold">{stats?.totalReferrals || 0}</p>
            <p className="text-sm text-gray-400 mt-2">Users you've recruited</p>
          </div>

          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold">Completed</h3>
            </div>
            <p className="text-3xl font-bold">{stats?.completedReferrals || 0}</p>
            <p className="text-sm text-gray-400 mt-2">Qualified referrals</p>
          </div>

          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-yellow-400" />
              <h3 className="text-lg font-semibold">Pending</h3>
            </div>
            <p className="text-3xl font-bold">{stats?.pendingReferrals || 0}</p>
            <p className="text-sm text-gray-400 mt-2">Within 3-week window</p>
          </div>

          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              <h3 className="text-lg font-semibold">Total Earned</h3>
            </div>
            <p className="text-3xl font-bold">{stats?.totalCoinsEarned?.toLocaleString() || 0}</p>
            <p className="text-sm text-gray-400 mt-2">Coins from referrals</p>
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
            Share this link to recruit new users. You'll earn 10,000 coins when they reach 40,000 paid coins within 21 days.
          </p>
        </div>

        {/* Referrals Table */}
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Referrals</h2>
          {referrals.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No referrals yet. Share your referral link to start earning!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {referrals.map((referral) => {
                const daysRemaining = Math.max(0, Math.ceil((new Date(referral.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                const progress = Math.min(100, (referral.referred_user?.paid_coin_balance || 0) / 40000 * 100)
                const isExpired = new Date(referral.deadline) < new Date()

                return (
                  <div key={referral.id} className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={referral.referred_user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${referral.referred_user?.username}`}
                          alt={referral.referred_user?.username}
                          className="w-12 h-12 rounded-full"
                        />
                        <div>
                          <div className="font-semibold text-white">{referral.referred_user?.username || 'Unknown'}</div>
                          <div className="text-sm text-gray-400">
                            Joined {new Date(referral.referred_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {referral.reward_status === 'completed' && (
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                            Completed
                          </span>
                        )}
                        {referral.reward_status === 'pending' && !isExpired && (
                          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
                            Pending
                          </span>
                        )}
                        {referral.reward_status === 'failed' && (
                          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Paid Coins Progress</span>
                        <span className="text-white font-medium">
                          {(referral.referred_user?.paid_coin_balance || 0).toLocaleString()} / 40,000
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>
                          {referral.reward_status === 'pending' && !isExpired
                            ? `${daysRemaining} days remaining`
                            : referral.reward_status === 'completed'
                            ? 'Qualified!'
                            : 'Expired'
                          }
                        </span>
                        <span>
                          {progress >= 100 ? 'Target reached!' : `${Math.round(progress)}% complete`}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rewards History */}
        {rewards.length > 0 && (
          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Rewards History</h2>
            <div className="space-y-3">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">
                      Referral reward for qualifying user
                    </p>
                    <p className="text-sm text-gray-400">
                      {new Date(reward.rewarded_at).toLocaleDateString()} • Automatic reward
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-yellow-400">
                      +{reward.coins_awarded.toLocaleString()} coins
                    </p>
                    <p className="text-xs text-gray-400">Empire Partner reward</p>
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

