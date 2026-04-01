import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import {
  Users, Crown, Coins, CheckCircle2, Clock, Copy,
  ArrowRight, ChevronDown, ChevronUp, Star, Shield
} from 'lucide-react'

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

export default function EmpirePartnerSection() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [referrals, setReferrals] = useState<ReferralEntry[]>([])
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

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
    } catch (err) {
      console.error('[EmpirePartnerSection] Error loading:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const copyReferralLink = () => {
    if (!user?.id) return
    const link = `${window.location.origin}/auth?ref=${user.id}`
    navigator.clipboard.writeText(link)
    toast.success('Referral link copied!')
  }

  if (loading) {
    return (
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-48 mb-3" />
        <div className="h-3 bg-zinc-800 rounded w-32" />
      </div>
    )
  }

  const isReferred = !!referrer
  const hasReferrals = referrals.length > 0

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Crown className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Empire Partner Program</h3>
              <p className="text-[10px] text-zinc-500">Earn $10 per qualified referral</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/empire-partner')}
            className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
          >
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Referred User View */}
        {isReferred && (
          <div className="mb-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1.5">
              <Star className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300">Referred by @{referrer.username}</span>
            </div>
            <p className="text-[10px] text-zinc-400">
              You joined via referral and receive a +2% cashout bonus automatically.
            </p>
            {profile && !profile.onboarding_complete && (
              <p className="text-[10px] text-yellow-400 mt-1">
                Complete your profile to activate your referral bonus.
              </p>
            )}
            {profile && !profile.is_qualified_referral && profile.onboarding_complete && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                  <span>Progress to qualification</span>
                  <span>{Math.min(100, Math.round(((profile.troll_coins || 0) / 5000) * 100))}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((profile.troll_coins || 0) / 5000) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Earn {(5000 - (profile.troll_coins || 0)).toLocaleString()} more coins to qualify
                </p>
              </div>
            )}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-white">{stats?.total_referrals || 0}</p>
            <p className="text-[9px] text-zinc-500 uppercase">Total</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-green-400">{stats?.qualified_referrals || 0}</p>
            <p className="text-[9px] text-zinc-500 uppercase">Qualified</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-yellow-400">{stats?.pending_referrals || 0}</p>
            <p className="text-[9px] text-zinc-500 uppercase">Pending</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-400">{stats?.in_progress_referrals || 0}</p>
            <p className="text-[9px] text-zinc-500 uppercase">In Progress</p>
          </div>
        </div>

        {/* Founding Status */}
        {stats?.is_founding_partner ? (
          <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-lg mb-3">
            <Shield className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-xs font-bold text-amber-300">Founding Empire Partner #{stats.founding_partner_rank}</p>
              <p className="text-[10px] text-zinc-400">+25% lifetime cashout bonus</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 bg-zinc-800/30 border border-zinc-700/50 rounded-lg mb-3">
            <Crown className="w-4 h-4 text-zinc-500" />
            <div>
              <p className="text-xs text-zinc-400">
                Founding spots claimed: {stats?.founding_spots_taken || 0} / {stats?.founding_spots_total || 15}
              </p>
              {(stats?.founding_spots_taken || 0) >= 15 ? (
                <p className="text-[10px] text-red-400">All spots claimed</p>
              ) : (
                <p className="text-[10px] text-zinc-500">Get a qualified referral to claim a spot</p>
              )}
            </div>
          </div>
        )}

        {/* Referral Link */}
        <div className="flex gap-2">
          <input
            type="text"
            value={`${window.location.origin}/auth?ref=${user?.id || ''}`}
            readOnly
            className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-[11px] text-zinc-300 font-mono truncate"
          />
          <button
            onClick={copyReferralLink}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
          >
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
      </div>

      {/* Referral List (collapsible) */}
      {hasReferrals && (
        <div className="border-t border-zinc-800">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <span>Your Referrals ({referrals.length})</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <div className="px-4 pb-3 space-y-2 max-h-60 overflow-y-auto">
              {referrals.map((ref) => (
                <div key={ref.referred_user_id} className="flex items-center gap-3 p-2 bg-zinc-800/30 rounded-lg">
                  <img
                    src={ref.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ref.username}`}
                    alt={ref.username}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-white truncate">@{ref.username}</span>
                      {ref.is_qualified_referral && (
                        <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            ref.is_qualified_referral
                              ? 'bg-green-500'
                              : 'bg-gradient-to-r from-purple-500 to-pink-500'
                          }`}
                          style={{ width: `${ref.progress_percent}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-zinc-500 whitespace-nowrap">
                        {ref.troll_coins.toLocaleString()}/5,000
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {ref.is_qualified_referral ? (
                      <span className="text-[9px] font-medium text-green-400">Qualified</span>
                    ) : !ref.onboarding_complete ? (
                      <span className="text-[9px] font-medium text-yellow-400">Onboarding</span>
                    ) : (
                      <span className="text-[9px] font-medium text-blue-400">In Progress</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
