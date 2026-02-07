import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { useCoins } from '../lib/hooks/useCoins'
import { supabase } from '../lib/supabase'
import { getFamilySeasonStats } from '../lib/familySeasons'
import { useXPStore } from '../stores/useXPStore'
import { useCreditScore } from '../lib/hooks/useCreditScore'
import CreditScoreBadge from '../components/CreditScoreBadge'
import { Crown, Sword, Trophy, Coins, Star, TrendingUp, Shield, Zap, ShoppingBag, Gavel, Store, Package, DollarSign } from 'lucide-react'
import { STORE_USD_PER_COIN } from '../lib/coinMath'

interface UserStats {
  level: number
  xp: number
  totalXp: number
  nextLevelXp: number
  troll_coins: number
  paid_coins: number
  familyName?: string
  familyLevel?: number
  familyXp?: number
  seasonScore?: number
  warWins?: number
  warLosses?: number
  warStreak?: string
  warTier?: string
  badges: string[]
}

export default function Stats() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { balances, loading: coinsLoading } = useCoins()
  const { xpTotal, level, xpToNext, progress, fetchXP, subscribeToXP, unsubscribe } = useXPStore()
  const { data: creditData, loading: creditLoading } = useCreditScore()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) return

      try {
        setLoading(true)

        // Fetch XP from store and subscribe to real-time updates
        await fetchXP(user.id)
        subscribeToXP(user.id)

        // Load family data
        let familyData = null
        const { data: familyMember } = await supabase
          .from('family_members')
          .select('family_id, role')
          .eq('user_id', user.id)
          .maybeSingle()

        if (familyMember?.family_id) {
          const familyStats = await getFamilySeasonStats(familyMember.family_id)
          const { data: family, error: familyError2 } = await supabase
            .from('troll_families')
            .select('name')
            .eq('id', familyMember.family_id)
            .maybeSingle()

          if (familyError2) {
            console.error('Error fetching family:', familyError2)
          }

          if (family) {
            familyData = {
              familyName: family.name,
              familyLevel: familyStats.seasonRank || 1,
              familyXp: familyStats.weeklyCoins || 0,
              seasonScore: familyStats.seasonCoins || 0
            }
          }
        }

        // Load war stats (placeholder for now)
        const warStats = {
          warWins: 0,
          warLosses: 0,
          warStreak: 0,
          warTier: 'Bronze'
        }

        // Calculate badges
        const badges = []
        if (profile?.role === 'admin' || profile?.troll_role === 'admin') badges.push('🛡️ Admin')
        if (familyMember) badges.push('⚔️ Family War')
        if (level >= 10) badges.push('👑 Top Rank')
        if (balances.paid_coins > 1000) badges.push('💰 Big Spender')

        setStats({
          level: level,
          xp: xpTotal,
          totalXp: xpTotal,
          nextLevelXp: xpToNext + xpTotal,
          troll_coins: balances.troll_coins || 0,
          paid_coins: balances.paid_coins || 0,
          ...familyData,
          ...warStats,
          badges
        })
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()

    return () => {
      unsubscribe()
    }
  }, [user?.id, level, xpTotal, xpToNext, profile?.role, profile?.troll_role, balances.troll_coins, balances.paid_coins, fetchXP, subscribeToXP, unsubscribe])

  const computedProgress =
    progress === 0 || progress
      ? (progress ?? 0) * 100
      : stats
        ? (stats.level / (stats.level + 1)) * 100
        : 0

  const levelProgress = Math.min(computedProgress, 100)
  const familyXpProgress = stats?.familyXp ? Math.min((stats.familyXp / 1000) * 100, 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent mb-2">
            Player Stats
          </h1>
          <p className="text-gray-400">View your comprehensive game statistics and achievements</p>
        </div>

        {/* Quick Shortcuts Menu */}
        <div className="bg-[#1A1A24] border border-purple-500/30 rounded-2xl p-6 mb-8">
          <h3 className="text-purple-300 font-semibold mb-4 flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5" />
            QUICK SHORTCUTS
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/store')}
              className="flex flex-col items-center gap-2 p-4 bg-[#2A2A34] rounded-xl hover:bg-[#3A3A45] hover:scale-105 transition-all border border-transparent hover:border-purple-500/50 group"
            >
              <div className="p-3 bg-yellow-500/10 rounded-full group-hover:bg-yellow-500/20 transition-colors">
                <ShoppingBag className="w-6 h-6 text-yellow-400" />
              </div>
              <span className="font-medium text-gray-200">Coin Store</span>
            </button>

            <button
              onClick={() => navigate('/marketplace')}
              className="flex flex-col items-center gap-2 p-4 bg-[#2A2A34] rounded-xl hover:bg-[#3A3A45] hover:scale-105 transition-all border border-transparent hover:border-blue-500/50 group"
            >
              <div className="p-3 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                <Store className="w-6 h-6 text-blue-400" />
              </div>
              <span className="font-medium text-gray-200">Shop</span>
            </button>

            <button
              onClick={() => navigate('/inventory')}
              className="flex flex-col items-center gap-2 p-4 bg-[#2A2A34] rounded-xl hover:bg-[#3A3A45] hover:scale-105 transition-all border border-transparent hover:border-green-500/50 group"
            >
              <div className="p-3 bg-green-500/10 rounded-full group-hover:bg-green-500/20 transition-colors">
                <Package className="w-6 h-6 text-green-400" />
              </div>
              <span className="font-medium text-gray-200">Inventory</span>
            </button>

            <button
              onClick={() => navigate('/my-earnings')}
              className="flex flex-col items-center gap-2 p-4 bg-[#2A2A34] rounded-xl hover:bg-[#3A3A45] hover:scale-105 transition-all border border-transparent hover:border-emerald-500/50 group"
            >
              <div className="p-3 bg-emerald-500/10 rounded-full group-hover:bg-emerald-500/20 transition-colors">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="font-medium text-gray-200">Earnings</span>
            </button>
          </div>
        </div>

        {loading || coinsLoading ? (
          <div className="text-center py-12 text-gray-400">Loading stats...</div>
        ) : stats ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEVEL & XP */}
            <div className="bg-[#1A1A24] border border-purple-500/30 rounded-2xl p-6 hover:border-purple-500/60 transition-colors">
              <h3 className="text-purple-300 font-semibold mb-4 flex items-center gap-2 text-lg">
                <Star className="w-5 h-5" />
                LEVEL & XP
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold text-2xl">Level {stats.level}</span>
                  <span className="text-gray-300 text-sm">
                    {stats.level} → {stats.level + 1}
                  </span>
                </div>
                <div className="w-full bg-[#2A2A34] rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
                <div className="text-center text-sm text-gray-400">
                  {Math.round(levelProgress)}% to next level
                </div>
                <div className="pt-4 border-t border-[#2C2C2C] space-y-2">
                  <div className="flex justify-between items-center text-sm text-gray-300">
                    <span>Current Level</span>
                    <span className="text-purple-400 font-semibold">{stats.level} / 2000</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <TrendingUp className="w-3 h-3" />
                    <span>Real-time sync enabled</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CREDIT SCORE */}
            <div className="bg-[#0F172A] border border-emerald-500/30 rounded-2xl p-6 hover:border-emerald-500/60 transition-colors">
              <h3 className="text-emerald-300 font-semibold mb-4 flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" />
                CREDIT SCORE
              </h3>
              <CreditScoreBadge
                score={creditData?.score}
                tier={creditData?.tier}
                trend7d={creditData?.trend_7d}
                loading={creditLoading}
              />
              <p className="text-xs text-gray-400 mt-3">
                Public credit score (0-800) reflecting reliability, loans, and community behavior.
              </p>
            </div>

            {/* FAMILY STATUS */}
            {stats.familyName && (
              <div className="bg-[#1A1A24] border border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-500/60 transition-colors">
                <h3 className="text-cyan-300 font-semibold mb-4 flex items-center gap-2 text-lg">
                  <Crown className="w-5 h-5" />
                  FAMILY STATUS
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold text-xl flex items-center gap-2">
                      🔥 {stats.familyName}
                    </span>
                    <span className="text-cyan-300 font-semibold">Level {stats.familyLevel}</span>
                  </div>
                  <div className="bg-[#2A2A34] rounded-lg p-3 space-y-2">
                    <div className="text-sm text-gray-300">
                      Family XP: <span className="text-cyan-400 font-semibold">{stats.familyXp?.toLocaleString() || 0}</span>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                        style={{ width: `${familyXpProgress}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-300 pt-2 border-t border-[#1A1A24]">
                      Season Score: <span className="text-cyan-400 font-semibold">{stats.seasonScore?.toLocaleString() || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BATTLE / WAR STATS */}
            <div className="bg-[#1A1A24] border border-red-500/30 rounded-2xl p-6 hover:border-red-500/60 transition-colors">
              <h3 className="text-red-300 font-semibold mb-4 flex items-center gap-2 text-lg">
                <Sword className="w-5 h-5" />
                BATTLE / WAR STATS
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#2A2A34] rounded-lg p-4 space-y-2">
                  <div className="text-sm text-gray-400">Wins</div>
                  <div className="text-3xl font-bold text-green-400">{stats.warWins}</div>
                </div>
                <div className="bg-[#2A2A34] rounded-lg p-4 space-y-2">
                  <div className="text-sm text-gray-400">Losses</div>
                  <div className="text-3xl font-bold text-red-400">{stats.warLosses}</div>
                </div>
                <div className="bg-[#2A2A34] rounded-lg p-4 space-y-2">
                  <div className="text-sm text-gray-400">Streak</div>
                  <div className="text-3xl font-bold text-orange-400 flex items-center gap-2">
                    {stats.warStreak}
                    {Number(stats.warStreak) > 0 && <span className="text-2xl">🔥</span>}
                  </div>
                </div>
                <div className="bg-[#2A2A34] rounded-lg p-4 space-y-2">
                  <div className="text-sm text-gray-400">Tier</div>
                  <div className="text-xl font-bold text-yellow-400">{stats.warTier}</div>
                </div>
              </div>
            </div>

            {/* CURRENCY */}
            <div className="bg-[#1A1A24] border border-green-500/30 rounded-2xl p-6 hover:border-green-500/60 transition-colors">
              <h3 className="text-green-300 font-semibold mb-4 flex items-center gap-2 text-lg">
                <Coins className="w-5 h-5" />
                CURRENCY & ASSETS
              </h3>
              <div className="space-y-3">
                <div className="bg-[#2A2A34] rounded-lg p-4 flex justify-between items-center">
                  <span className="text-white flex items-center gap-2">
                    <span className="text-2xl">🎫</span>
                    Troll Coins
                  </span>
                  <span className="font-bold text-yellow-400 text-xl">
                    {stats.troll_coins.toLocaleString()}
                  </span>
                </div>
                <div className="bg-[#2A2A34] rounded-lg p-4 flex justify-between items-center relative group">
                  <span className="text-white flex items-center gap-2">
                    <span className="text-2xl">💰</span>
                    Gifted Coins
                  </span>
                  <span className="font-bold text-green-400 text-xl">
                    {stats.paid_coins.toLocaleString()}
                  </span>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Purchased/Gifted Coins
                  </div>
                </div>
                <div className="bg-[#1A1A24] border border-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Total Coins Value</span>
                    <span className="font-bold text-yellow-400 text-lg">
                      ${((stats.troll_coins + stats.paid_coins) * STORE_USD_PER_COIN).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Estimated value based on current rates
                  </div>
                </div>
              </div>
            </div>

            {/* BADGES */}
            <div className="bg-[#1A1A24] border border-yellow-500/30 rounded-2xl p-6 hover:border-yellow-500/60 transition-colors lg:col-span-2">
              <h3 className="text-yellow-300 font-semibold mb-4 flex items-center gap-2 text-lg">
                <Trophy className="w-5 h-5" />
                BADGES & ACHIEVEMENTS
              </h3>
              <div className="flex flex-wrap gap-3">
                {stats.badges.length > 0 ? (
                  stats.badges.map((badge, index) => (
                    <span
                      key={index}
                      className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 font-medium hover:border-yellow-500/60 transition-colors"
                    >
                      {badge}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400">No badges earned yet. Keep playing to unlock achievements!</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">Failed to load stats</div>
        )}
      </div>
    </div>
  )
}
