import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import {
  Users, Coins, CheckCircle2, Copy, Clock, Crown, Shield,
  ArrowRight, Star, ChevronRight, TrendingUp, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface ReferralStats {
  total_referrals: number
  qualified_referrals: number
  pending_referrals: number
  in_progress_referrals: number
  is_founding_partner: boolean
  founding_partner_rank: number | null
  founding_spots_taken: number
  founding_spots_total: number
}

interface ReferralEntry {
  referred_user_id: string
  username: string
  avatar_url: string
  troll_coins: number
  total_earned_coins: number
  onboarding_complete: boolean
  is_qualified_referral: boolean
  qualified_referral_at: string | null
  referred_at: string
  progress_percent: number
}

interface ReferrerInfo {
  referrer_id: string
  username: string
  avatar_url: string
}

export default function EmpirePartnerDashboard() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [referrals, setReferrals] = useState<ReferralEntry[]>([])
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [referralLink, setReferralLink] = useState('')

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [statsRes, listRes, referrerRes] = await Promise.all([
        supabase.rpc('get_referral_stats', { p_user_id: user.id }),
        supabase.rpc('get_referral_list', { p_user_id: user.id }),
        supabase.rpc('get_my_referrer', { p_user_id: user.id }),
      ])

      if (statsRes.data) setStats(statsRes.data)
      if (listRes.data) setReferrals(listRes.data)
      if (referrerRes.data && referrerRes.data.referrer_id) setReferrer(referrerRes.data)
    } catch (error: any) {
      console.error('Error loading referral data:', error)
      toast.error('Failed to load referral data')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      loadData()
      setReferralLink(`${window.location.origin}/auth?ref=${user.id}`)

      const channel = supabase
        .channel('referral_dashboard_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => loadData())
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
  }, [user?.id, loadData])

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink)
    toast.success('Referral link copied!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto" />
            <p className="mt-4 text-gray-400">Loading Empire Partner data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button onClick={() => navigate('/my-earnings')} className="text-sm text-slate-400 hover:text-white mb-2 flex items-center gap-1">
            <ArrowRight className="w-3 h-3 rotate-180" /> Back to Earnings
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Empire Partner Program
          </h1>
          <p className="text-slate-400 mt-1">Earn $10 for every qualified referral. First 15 get +25% lifetime bonus.</p>
        </div>

        {/* Referred User Banner */}
        {referrer && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm font-semibold text-purple-300">
                  Referred by @{referrer.username}
                </p>
                <p className="text-xs text-zinc-400">
                  You receive a +2% automatic cashout bonus. Complete onboarding and earn 5,000 coins to fully activate.
                </p>
              </div>
            </div>
            {profile && !profile.onboarding_complete && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-yellow-300">Complete your profile to activate your referral bonus.</span>
                <button onClick={() => navigate('/profile/setup')} className="ml-auto text-xs text-yellow-400 hover:text-yellow-300">
                  Complete Profile <ChevronRight className="w-3 h-3 inline" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="text-xs text-zinc-400">Total Referrals</span>
            </div>
            <p className="text-2xl font-bold">{stats?.total_referrals || 0}</p>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-xs text-zinc-400">Qualified</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{stats?.qualified_referrals || 0}</p>
            <p className="text-[10px] text-zinc-500">${((stats?.qualified_referrals || 0) * 10).toFixed(2)} earned</p>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-xs text-zinc-400">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{stats?.pending_referrals || 0}</p>
            <p className="text-[10px] text-zinc-500">awaiting onboarding</p>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className="text-xs text-zinc-400">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{stats?.in_progress_referrals || 0}</p>
            <p className="text-[10px] text-zinc-500">earning coins</p>
          </div>
        </div>

        {/* Founding Partner Status */}
        {stats?.is_founding_partner ? (
          <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-300">Founding Empire Partner #{stats.founding_partner_rank}</p>
                <p className="text-sm text-zinc-400">You earn +25% on all cashouts for life.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                <Crown className="w-6 h-6 text-zinc-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-300">Founding Empire Partner</p>
                <p className="text-xs text-zinc-500">
                  {stats && stats.founding_spots_taken >= 15
                    ? 'All 15 spots have been claimed.'
                    : `${stats?.founding_spots_taken || 0} of 15 spots claimed. Get your first qualified referral to claim one.`
                  }
                </p>
                <div className="w-full h-2 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full"
                    style={{ width: `${((stats?.founding_spots_taken || 0) / 15) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-zinc-800/30 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-purple-400 font-bold">1</span>
              </div>
              <p className="text-sm font-medium text-white">Share Your Link</p>
              <p className="text-xs text-zinc-500 mt-1">Copy and share your unique referral link.</p>
            </div>
            <div className="text-center p-4 bg-zinc-800/30 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-purple-400 font-bold">2</span>
              </div>
              <p className="text-sm font-medium text-white">They Complete Onboarding</p>
              <p className="text-xs text-zinc-500 mt-1">Referred user sets up their profile.</p>
            </div>
            <div className="text-center p-4 bg-zinc-800/30 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-purple-400 font-bold">3</span>
              </div>
              <p className="text-sm font-medium text-white">They Earn 5,000 Coins</p>
              <p className="text-xs text-zinc-500 mt-1">You earn $10. They get +2% cashout bonus.</p>
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-3">Your Referral Link</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 text-sm text-zinc-300 font-mono"
            />
            <button onClick={copyReferralLink} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
              <Copy className="w-4 h-4" /> Copy
            </button>
          </div>
        </div>

        {/* Referral List */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-4">Your Referrals ({referrals.length})</h2>
          {referrals.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No referrals yet. Share your link to start earning!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.map((ref) => (
                <div key={ref.referred_user_id} className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={ref.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ref.username}`}
                        alt={ref.username}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">@{ref.username}</span>
                          {ref.is_qualified_referral && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-[10px] font-bold">Qualified</span>
                          )}
                          {!ref.onboarding_complete && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-[10px] font-bold">Onboarding</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">
                          Joined {new Date(ref.referred_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{ref.troll_coins.toLocaleString()} <span className="text-zinc-500 font-normal">/ 5,000</span></p>
                      <p className="text-xs text-zinc-500">{ref.progress_percent}% complete</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ref.is_qualified_referral ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
                      }`}
                      style={{ width: `${ref.progress_percent}%` }}
                    />
                  </div>
                  {!ref.is_qualified_referral && (
                    <p className="text-[10px] text-zinc-500 mt-1.5">
                      {ref.onboarding_complete
                        ? `Needs ${(5000 - ref.troll_coins).toLocaleString()} more coins to qualify.`
                        : 'Must complete onboarding first, then earn 5,000 coins.'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
