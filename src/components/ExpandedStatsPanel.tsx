import React, { useEffect, useState } from 'react'
import { X, Crown, Sword, Trophy, Coins, Gem, Star } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { getLevelProfile, getDnaProfile } from '../lib/progressionEngine'
import { getFamilySeasonStats } from '../lib/familySeasons'

interface ExpandedStatsPanelProps {
  isOpen: boolean
  onClose: () => void
}

interface UserStats {
  level: number
  xp: number
  totalXp: number
  nextLevelXp: number
  paidCoins: number
  trollmonds: number
  familyName?: string
  familyLevel?: number
  familyXp?: number
  seasonScore?: number
  warWins?: number
  warLosses?: number
  warStreak?: number
  warTier?: string
  badges: string[]
}

export default function ExpandedStatsPanel({ isOpen, onClose }: ExpandedStatsPanelProps) {
  const { user, profile } = useAuthStore()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !user?.id) return

    const loadStats = async () => {
      try {
        setLoading(true)

        // Load level and XP data
        const levelData = await getLevelProfile(user.id)
        const dnaData = await getDnaProfile(user.id)

        // Use profile balances

        // Load family data
        let familyData = null
        const { data: familyMember } = await supabase
          .from('family_members')
          .select('family_id, role')
          .eq('user_id', user.id)
          .single()

        if (familyMember?.family_id) {
          const familyStats = await getFamilySeasonStats(familyMember.family_id)
          const { data: family } = await supabase
            .from('troll_families')
            .select('name')
            .eq('id', familyMember.family_id)
            .single()

          familyData = {
            familyName: family?.name,
            familyLevel: familyStats.seasonRank || 1,
            familyXp: familyStats.weeklyCoins || 0,
            seasonScore: familyStats.seasonCoins || 0
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
        if (profile?.role === 'admin') badges.push('🛡️ Admin')
        if (familyMember) badges.push('⚔️ Family War')
        if (levelData.level >= 10) badges.push('👑 Top Rank')

        setStats({
          level: levelData.level,
          xp: levelData.xp,
          totalXp: levelData.total_xp,
          nextLevelXp: levelData.next_level_xp,
          paidCoins: profile?.troll_coins || 0,
          trollmonds: profile?.free_coin_balance || 0,
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
  }, [isOpen, user?.id, profile])

  if (!isOpen) return null

  const xpProgress = stats ? (stats.xp / stats.nextLevelXp) * 100 : 0
  const familyXpProgress = stats?.familyXp ? Math.min((stats.familyXp / 1000) * 100, 100) : 0 // Example calculation

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0A0A14] border border-[#2C2C2C] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2C2C2C]">
          <h2 className="text-xl font-bold text-white">Player Stats</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading stats...</div>
          ) : stats ? (
            <>
              {/* LEVEL & XP */}
              <div className="bg-[#1A1A24] border border-purple-500/30 rounded-xl p-4">
                <h3 className="text-purple-300 font-semibold mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  LEVEL & XP
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold text-lg">Level {stats.level}</span>
                    <span className="text-gray-300 text-sm">
                      {stats.xp.toLocaleString()} / {stats.nextLevelXp.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="w-full bg-[#2A2A34] rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                      style={{ width: `${xpProgress}%` }}
                    />
                  </div>
                  <div className="text-center text-xs text-gray-400">
                    {Math.round(xpProgress)}% to next level
                  </div>
                </div>
              </div>

              {/* FAMILY STATUS */}
              {stats.familyName && (
                <div className="bg-[#1A1A24] border border-cyan-500/30 rounded-xl p-4">
                  <h3 className="text-cyan-300 font-semibold mb-3 flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    FAMILY STATUS
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold flex items-center gap-2">
                        🔥 {stats.familyName} (Level {stats.familyLevel})
                      </span>
                    </div>
                    <div className="text-sm text-gray-300">
                      Family XP: {stats.familyXp?.toLocaleString() || 0}
                    </div>
                    <div className="w-full bg-[#2A2A34] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                        style={{ width: `${familyXpProgress}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-300">
                      Season Score: {stats.seasonScore?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>
              )}

              {/* BATTLE / WAR STATS */}
              <div className="bg-[#1A1A24] border border-red-500/30 rounded-xl p-4">
                <h3 className="text-red-300 font-semibold mb-3 flex items-center gap-2">
                  <Sword className="w-4 h-4" />
                  BATTLE / WAR STATS
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-green-400 font-semibold">Wins: {stats.warWins}</div>
                    <div className="text-red-400">Losses: {stats.warLosses}</div>
                  </div>
                  <div>
                    <div className="text-orange-400 font-semibold flex items-center gap-1">
                      Streak: {stats.warStreak}
                      {stats.warStreak > 0 && <span className="text-lg">🔥</span>}
                    </div>
                    <div className="text-yellow-400">Tier: {stats.warTier}</div>
                  </div>
                </div>
              </div>

              {/* CURRENCY */}
              <div className="bg-[#1A1A24] border border-green-500/30 rounded-xl p-4">
                <h3 className="text-green-300 font-semibold mb-3 flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  CURRENCY
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white flex items-center gap-2">
                      <span className="text-lg">💰</span>
                      Troll Coins
                    </span>
                    <span className="font-bold text-green-400">
                      {stats.paidCoins.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white flex items-center gap-2">
                      <span className="text-lg">💎</span>
                      Trollmonds
                    </span>
                    <span className="font-bold text-cyan-400">
                      {stats.trollmonds.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-[#2C2C2C]">
                    <span className="text-gray-300">Cashout Value</span>
                    <span className="font-bold text-yellow-400">
                      ${(stats.paidCoins * 0.0001 * 0.8).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* BADGES */}
              <div className="bg-[#1A1A24] border border-yellow-500/30 rounded-xl p-4">
                <h3 className="text-yellow-300 font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  BADGES
                </h3>
                <div className="flex flex-wrap gap-2">
                  {stats.badges.length > 0 ? (
                    stats.badges.map((badge, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 text-sm font-medium"
                      >
                        {badge}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 text-sm">No badges earned yet</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-8">Failed to load stats</div>
          )}
        </div>
      </div>
    </div>
  )
}