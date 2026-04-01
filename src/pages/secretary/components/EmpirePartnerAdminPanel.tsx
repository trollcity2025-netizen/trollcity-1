import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import {
  Users, Crown, Shield, CheckCircle2, XCircle, AlertTriangle,
  Search, RefreshCw, Coins, ArrowUpDown
} from 'lucide-react'

interface ReferralOverview {
  total_referrals: number
  qualified_referrals: number
  onboarding_incomplete: number
  founding_partners: number
  referred_with_bonus: number
  total_bonus_coins: number
}

interface ReferrerRow {
  user_id: string
  username: string
  avatar_url: string
  total_referrals: number
  qualified_referrals: number
  is_founding_partner: boolean
  founding_partner_rank: number | null
  is_empire_partner: boolean
  partner_status: string | null
}

interface ReferredUserRow {
  user_id: string
  username: string
  avatar_url: string
  referred_by_id: string
  referred_by_username: string
  troll_coins: number
  total_earned_coins: number
  onboarding_complete: boolean
  is_qualified_referral: boolean
  qualified_referral_at: string | null
  is_founding_partner: boolean
  founding_partner_rank: number | null
  referred_user_bonus_active: boolean
  created_at: string
}

type SortField = 'username' | 'troll_coins' | 'total_referrals' | 'qualified_referrals' | 'created_at'

export default function EmpirePartnerAdminPanel() {
  const [overview, setOverview] = useState<ReferralOverview | null>(null)
  const [referrers, setReferrers] = useState<ReferrerRow[]>([])
  const [referredUsers, setReferredUsers] = useState<ReferredUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'overview' | 'referrers' | 'referred'>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, referrersRes, referredRes] = await Promise.all([
        supabase.rpc('admin_get_referral_overview'),
        supabase.rpc('admin_get_all_referrers'),
        supabase.rpc('admin_get_all_referrals'),
      ])

      if (overviewRes.data) setOverview(overviewRes.data)
      if (referrersRes.data) setReferrers(referrersRes.data)
      if (referredRes.data) setReferredUsers(referredRes.data)
    } catch (err) {
      console.error('[EmpirePartnerAdminPanel] Error:', err)
      toast.error('Failed to load referral data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const toggleFounding = async (userId: string, grant: boolean) => {
    try {
      await supabase.rpc('admin_toggle_founding_partner', { p_user_id: userId, p_grant: grant })
      toast.success(grant ? 'Founding partner granted' : 'Founding partner revoked')
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update')
    }
  }

  const toggleBonus = async (userId: string, active: boolean) => {
    try {
      await supabase.rpc('admin_toggle_referred_bonus', { p_user_id: userId, p_active: active })
      toast.success(active ? 'Bonus activated' : 'Bonus deactivated')
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update')
    }
  }

  const filteredReferred = referredUsers.filter(u =>
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.referred_by_username?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredReferrers = referrers.filter(u =>
    u.username?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Empire Partner Program</h2>
        <p className="text-slate-400">Manage referrals, founding partners, and bonuses.</p>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'overview' as const, label: 'Overview' },
          { id: 'referrers' as const, label: 'Referrers' },
          { id: 'referred' as const, label: 'Referred Users' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={loadData}
          className="ml-auto px-3 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search */}
      {(activeView === 'referrers' || activeView === 'referred') && (
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by username..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500"
          />
        </div>
      )}

      {/* Overview */}
      {activeView === 'overview' && overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-xs text-slate-400 uppercase">Total Referrals</span>
            </div>
            <p className="text-2xl font-bold text-white">{overview.total_referrals}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-xs text-slate-400 uppercase">Qualified</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{overview.qualified_referrals}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-xs text-slate-400 uppercase">Onboarding Incomplete</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{overview.onboarding_incomplete}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <span className="text-xs text-slate-400 uppercase">Founding Partners</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{overview.founding_partners} / 15</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-purple-400" />
              <span className="text-xs text-slate-400 uppercase">With 2% Bonus</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{overview.referred_with_bonus}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              <span className="text-xs text-slate-400 uppercase">Total Coins</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {(overview.total_bonus_coins || 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Referrers Table */}
      {activeView === 'referrers' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-slate-400 uppercase font-medium text-xs">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Total Referrals</th>
                <th className="p-3">Qualified</th>
                <th className="p-3">Founding</th>
                <th className="p-3">Empire Partner</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500">Loading...</td></tr>
              ) : filteredReferrers.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500">No referrers found</td></tr>
              ) : (
                filteredReferrers.map(r => (
                  <tr key={r.user_id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={r.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.username}`}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                        <span className="font-medium text-white">@{r.username}</span>
                      </div>
                    </td>
                    <td className="p-3">{r.total_referrals}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.qualified_referrals > 0 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {r.qualified_referrals}
                      </span>
                    </td>
                    <td className="p-3">
                      {r.is_founding_partner ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">
                          #{r.founding_partner_rank}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {r.is_empire_partner ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400">Active</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {r.is_founding_partner ? (
                          <button
                            onClick={() => toggleFounding(r.user_id, false)}
                            className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleFounding(r.user_id, true)}
                            disabled={(overview?.founding_partners || 0) >= 15}
                            className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Grant
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Referred Users Table */}
      {activeView === 'referred' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-slate-400 uppercase font-medium text-xs">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Referred By</th>
                <th className="p-3">Coins</th>
                <th className="p-3">Onboarding</th>
                <th className="p-3">Qualified</th>
                <th className="p-3">2% Bonus</th>
                <th className="p-3">Joined</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr><td colSpan={8} className="p-4 text-center text-slate-500">Loading...</td></tr>
              ) : filteredReferred.length === 0 ? (
                <tr><td colSpan={8} className="p-4 text-center text-slate-500">No referred users found</td></tr>
              ) : (
                filteredReferred.map(u => (
                  <tr key={u.user_id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                        <span className="font-medium text-white">@{u.username}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-400">@{u.referred_by_username || 'Unknown'}</td>
                    <td className="p-3">
                      <div>
                        <span className="text-white font-medium">{u.troll_coins.toLocaleString()}</span>
                        <span className="text-slate-500"> / 5,000</span>
                      </div>
                      <div className="w-20 h-1 bg-slate-700 rounded-full mt-1">
                        <div
                          className={`h-full rounded-full ${u.is_qualified_referral ? 'bg-green-500' : 'bg-purple-500'}`}
                          style={{ width: `${Math.min(100, (u.troll_coins / 5000) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="p-3">
                      {u.onboarding_complete ? (
                        <span className="text-green-400 text-xs font-medium">Complete</span>
                      ) : (
                        <span className="text-yellow-400 text-xs font-medium">Pending</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.is_qualified_referral ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">Yes</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-400">No</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.referred_user_bonus_active ? (
                        <span className="text-green-400 text-xs font-medium">Active</span>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => toggleBonus(u.user_id, !u.referred_user_bonus_active)}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            u.referred_user_bonus_active
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          }`}
                        >
                          {u.referred_user_bonus_active ? 'Disable' : 'Enable'} Bonus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
