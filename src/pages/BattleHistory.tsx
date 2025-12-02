import React, { useEffect, useState } from 'react'
import { Trophy, Sword, Clock, Coins, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import ClickableUsername from '../components/ClickableUsername'

interface BattleHistoryItem {
  id: string
  battle_id: string
  user_id: string
  opponent_id: string
  won: boolean
  paid_coins_received: number
  paid_coins_sent: number
  battle_duration_seconds: number
  created_at: string
  opponent?: {
    username: string
    avatar_url: string
  }
  battle?: {
    host_id: string
    challenger_id: string
    host_paid_coins: number
    challenger_paid_coins: number
    host_free_coins: number
    challenger_free_coins: number
  }
}

export default function BattleHistory() {
  const { user, profile } = useAuthStore()
  const [battles, setBattles] = useState<BattleHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalBattles: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    totalCoinsReceived: 0,
    totalCoinsSent: 0,
  })

  useEffect(() => {
    if (!user) return
    loadBattleHistory()
  }, [user])

  const loadBattleHistory = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('battle_history')
        .select(`
          *,
          opponent:opponent_id (username, avatar_url),
          battle:battle_id (
            host_id,
            challenger_id,
            winner_id,
            host_paid_coins,
            challenger_paid_coins,
            host_free_coins,
            challenger_free_coins
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const battleHistory = (data || []) as BattleHistoryItem[]
      setBattles(battleHistory)

      // Calculate stats
      const wins = battleHistory.filter(b => b.won).length
      const losses = battleHistory.filter(b => !b.won && b.battle?.winner_id !== null).length
      const ties = battleHistory.filter(b => b.battle?.winner_id === null).length
      // Get total coins (paid + free) from battle data
      const totalCoinsReceived = battleHistory.reduce((sum, b) => {
        if (!b.battle) return sum
        const userTotal = b.battle.host_id === b.user_id
          ? (b.battle.host_paid_coins || 0) + (b.battle.host_free_coins || 0)
          : (b.battle.challenger_paid_coins || 0) + (b.battle.challenger_free_coins || 0)
        return sum + userTotal
      }, 0)
      const totalCoinsSent = battleHistory.reduce((sum, b) => sum + (b.paid_coins_sent || 0), 0)

      setStats({
        totalBattles: battleHistory.length,
        wins,
        losses,
        ties,
        totalCoinsReceived,
        totalCoinsSent,
      })
    } catch (err: any) {
      console.error('Error loading battle history:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTotalCoins = (battle: any, userId: string) => {
    if (!battle) return 0
    if (battle.host_id === userId) {
      return (battle.host_paid_coins || 0) + (battle.host_free_coins || 0)
    } else {
      return (battle.challenger_paid_coins || 0) + (battle.challenger_free_coins || 0)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">Loading battle history...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sword className="w-8 h-8 text-troll-neon-blue" />
            <h1 className="text-3xl font-bold">Troll Battle History</h1>
          </div>
          <p className="text-gray-400">Your complete battle record and statistics</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/40 border border-purple-500/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Battles</div>
            <div className="text-2xl font-bold text-troll-neon-blue">{stats.totalBattles}</div>
          </div>
          <div className="bg-black/40 border border-green-500/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Wins</div>
            <div className="text-2xl font-bold text-green-400">{stats.wins}</div>
          </div>
          <div className="bg-black/40 border border-red-500/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Losses</div>
            <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
          </div>
          <div className="bg-black/40 border border-yellow-500/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-yellow-400">
              {stats.totalBattles > 0 ? Math.round((stats.wins / stats.totalBattles) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Coin Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-black/40 border border-troll-gold/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-troll-gold" />
              <div className="text-sm text-gray-400">Coins Received</div>
            </div>
            <div className="text-2xl font-bold text-troll-gold">
              {stats.totalCoinsReceived.toLocaleString()}
            </div>
          </div>
          <div className="bg-black/40 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-purple-400" />
              <div className="text-sm text-gray-400">Coins Sent</div>
            </div>
            <div className="text-2xl font-bold text-purple-400">
              {stats.totalCoinsSent.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Battle List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold mb-4">Recent Battles</h2>
          
          {battles.length === 0 ? (
            <div className="text-center py-12 bg-black/40 rounded-lg border border-gray-700">
              <Sword className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No battles yet. Start your first battle from a live stream!</p>
            </div>
          ) : (
            battles.map((battle) => {
              const totalCoins = getTotalCoins(battle.battle, battle.user_id)
              const opponentTotalCoins = battle.battle 
                ? getTotalCoins(battle.battle, battle.opponent_id)
                : 0

              return (
                <div
                  key={battle.id}
                  className={`bg-black/40 border-2 rounded-lg p-4 ${
                    battle.won
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-gray-700 bg-gray-900/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {battle.won ? (
                        <Trophy className="w-6 h-6 text-troll-gold" />
                      ) : (
                        <Sword className="w-6 h-6 text-gray-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            vs <ClickableUsername username={battle.opponent?.username || 'Unknown'} />
                          </span>
                          {battle.won && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                              VICTORY
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(battle.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Duration</div>
                      <div className="font-mono text-sm">
                        {formatTime(battle.battle_duration_seconds || 120)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-700">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Your Coins</div>
                      <div className="text-lg font-bold text-troll-gold">
                        {totalCoins.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Paid: {(battle.battle?.host_id === battle.user_id 
                          ? battle.battle.host_paid_coins 
                          : battle.battle?.challenger_paid_coins) || 0} • 
                        Free: {(battle.battle?.host_id === battle.user_id 
                          ? battle.battle.host_free_coins 
                          : battle.battle?.challenger_free_coins) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Opponent Coins</div>
                      <div className="text-lg font-bold text-gray-400">
                        {opponentTotalCoins.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Paid: {(battle.battle?.host_id === battle.opponent_id 
                          ? battle.battle.host_paid_coins 
                          : battle.battle?.challenger_paid_coins) || 0} • 
                        Free: {(battle.battle?.host_id === battle.opponent_id 
                          ? battle.battle.host_free_coins 
                          : battle.battle?.challenger_free_coins) || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

