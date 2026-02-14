import React, { useState, useEffect, useCallback } from 'react'
import { supabase, UserProfile } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  Trophy, Medal, Award, TrendingUp,
  Star, Users, Coins, Crown
} from 'lucide-react'
import { Virtuoso } from 'react-virtuoso'

const FamilyLeaderboard = ({ user: _authUser }: { user?: UserProfile | null }) => {
  const { user } = useAuthStore()
  const [leaderboard, setLeaderboard] = useState([])
  const [userFamily, setUserFamily] = useState(null)
  const [activeTab, setActiveTab] = useState('total') // 'total', 'weekly', 'season'
  const [loading, setLoading] = useState(true)
  const [seasonInfo, setSeasonInfo] = useState(null)

  const loadSeasonInfo = useCallback(async () => {
    try {
      const { data: season } = await supabase
        .from('family_seasons')
        .select('*')
        .eq('is_active', true)
        .single()

      setSeasonInfo(season)
    } catch (error) {
      console.error('Error loading season info:', error)
    }
  }, [])

  const loadLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      let orderBy = 'total_coins'
      switch (activeTab) {
        case 'weekly':
          orderBy = 'weekly_coins'
          break
        case 'season':
          orderBy = 'season_coins'
          break
        default:
          orderBy = 'total_coins'
      }

      // Get user's family for highlighting
      if (user) {
        const { data: membership } = await supabase
          .from('family_members')
          .select('family_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (membership) {
          setUserFamily(membership.family_id)
        }
      }

      // Load leaderboard with member counts
      const { data: families } = await supabase
        .from('family_stats')
        .select(`
          *,
          troll_families (
            id,
            name,
            emblem_url,
            description
          )
        `)
        .order(orderBy, { ascending: false })
        .limit(100)

      // Add member counts
      const familiesWithMembers = await Promise.all(
        (families || []).map(async (family) => {
          const { count: memberCount } = await supabase
            .from('family_members')
            .select('*', { count: 'exact', head: true })
            .eq('family_id', family.family_id)

          return {
            ...family,
            memberCount: memberCount || 0
          }
        })
      )

      setLeaderboard(familiesWithMembers)
    } catch (error) {
      console.error('Error loading leaderboard:', error)
      toast.error('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [activeTab, user])

  useEffect(() => {
    loadLeaderboard()
    loadSeasonInfo()
  }, [loadLeaderboard, loadSeasonInfo])

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-lg font-bold text-gray-400">#{rank}</span>
    }
  }

  const formatCoins = (coins) => {
    if (coins >= 1000000) {
      return `${(coins / 1000000).toFixed(1)}M`
    } else if (coins >= 1000) {
      return `${(coins / 1000).toFixed(1)}K`
    }
    return coins.toLocaleString()
  }

  const getTabLabel = (tab) => {
    switch (tab) {
      case 'total':
        return 'All-Time'
      case 'weekly':
        return 'Weekly'
      case 'season':
        return 'Season'
      default:
        return tab
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <Trophy className="animate-spin w-8 h-8 mx-auto mb-4 text-yellow-400" />
          <p>Loading leaderboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-400" />
            FAMILY LEADERBOARD
          </h1>
          <p className="text-gray-300">Compete with families across Troll City</p>

          {/* Season Banner */}
          {seasonInfo && (
            <div className="mt-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 text-purple-300">
                <Star className="w-5 h-5" />
                <span className="font-semibold">{seasonInfo.name}</span>
                <span className="text-sm opacity-75">
                  Ends {new Date(seasonInfo.ends_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex justify-center">
          <div className="bg-zinc-900 rounded-lg p-1 flex gap-1">
            {['total', 'weekly', 'season'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-md font-semibold transition-colors ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {getTabLabel(tab)}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
          <div className="p-6 border-b border-zinc-700">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Top Families - {getTabLabel(activeTab)}
            </h2>
          </div>

          <div className="min-h-[400px]">
            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No families found</p>
              </div>
            ) : (
              <Virtuoso
                style={{ height: '600px' }}
                data={leaderboard}
                itemContent={(index, family) => {
                  const rank = index + 1
                  const isUserFamily = userFamily === family.family_id

                  return (
                    <div
                      className={`p-4 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800 last:border-0 ${
                        isUserFamily ? 'bg-purple-900/20 border-l-4 border-purple-500' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className="flex items-center justify-center w-12">
                          {getRankIcon(rank)}
                        </div>

                        {/* Family Info */}
                        <div className="flex items-center gap-3 flex-1">
                          {family.troll_families?.emblem_url && (
                            <img
                              src={family.troll_families.emblem_url}
                              alt={`${family.troll_families.name} emblem`}
                              className="w-10 h-10 rounded-full border border-zinc-600"
                            />
                          )}
                          <div>
                            <h3 className={`font-semibold ${isUserFamily ? 'text-purple-400' : 'text-white'}`}>
                              {family.troll_families?.name || 'Unknown Family'}
                              {isUserFamily && <span className="ml-2 text-xs text-purple-300">(Your Family)</span>}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {family.memberCount} members
                              </span>
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                Level {family.level}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Coins */}
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-yellow-400">
                            <Coins className="w-4 h-4" />
                            <span className="font-bold text-lg">
                              {formatCoins(
                                activeTab === 'weekly' ? family.weekly_coins :
                                activeTab === 'season' ? family.season_coins :
                                family.total_coins
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {activeTab === 'total' ? 'Total Family Tokens' :
                             activeTab === 'weekly' ? 'Weekly Family Tokens' :
                             'Season Family Tokens'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
            )}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-700 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
            <p className="text-2xl font-bold text-yellow-400">{leaderboard.length}</p>
            <p className="text-sm text-gray-400">Active Families</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-700 text-center">
            <Coins className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-2xl font-bold text-green-400">
              {formatCoins(leaderboard.reduce((sum, f) => sum + f.total_coins, 0))}
            </p>
            <p className="text-sm text-gray-400">Total Family Tokens in Circulation</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-700 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold text-blue-400">
              {leaderboard.reduce((sum, f) => sum + f.memberCount, 0)}
            </p>
            <p className="text-sm text-gray-400">Total Family Members</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/30 rounded-xl p-6 text-center">
          <Crown className="w-12 h-12 mx-auto mb-4 text-purple-400" />
          <h3 className="text-xl font-bold mb-2">Ready to Climb the Ranks?</h3>
          <p className="text-gray-300 mb-4">
            Join a family or create your own to start earning family tokens and competing for glory!
          </p>
          <button
            onClick={() => window.location.href = '/family/browse'}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Explore Families
          </button>
        </div>
      </div>
    </div>
  )
}

export default FamilyLeaderboard
