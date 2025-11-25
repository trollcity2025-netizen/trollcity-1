import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Trophy, Crown, Users, Star, Map } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface FamilyRow {
  family_id: string
  family_name: string
  task_count: number
}

export default function TrollFamilyCity() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [rows, setRows] = useState<FamilyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const loadLeaderboard = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_weekly_family_task_counts')
    if (error) {
      console.error(error)
      setRows([])
    } else {
      setRows((data || []) as FamilyRow[])
    }
    setLoading(false)
  }

  const getRankName = (tasks: number) => {
    if (tasks >= 30) return 'Royal Family'
    if (tasks >= 20) return 'Diamond Clan'
    if (tasks >= 15) return 'Platinum Squad'
    if (tasks >= 10) return 'Gold Tribe'
    if (tasks >= 5) return 'Silver House'
    return 'Bronze Family'
  }

  const handleGoProfile = () => navigate('/family/profile')
  const handleGoWars = () => navigate('/family/wars')
  const handleGoChat = () => navigate('/family/chat')

  return (
    <div className="min-h-screen tc-cosmic-bg text-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-extrabold gradient-text-green-pink flex items-center gap-2">
          🏙️ Troll Family City
        </h1>
        <button
          onClick={loadLeaderboard}
          className="gaming-button px-3 py-1 rounded text-xs"
        >
          Refresh
        </button>
      </div>

      <p className="text-sm text-gray-300 mb-4">
        Complete weekly tasks with your Troll Family. The family with the most
        completed tasks earns{' '}
        <span className="text-green-400 font-bold">10,000 free coins</span> split
        across members + the 👑 Crown badge & Royal Entrance for the week.
      </p>

      {/* Quick Nav */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <button
          onClick={handleGoProfile}
          className="troll-card p-3 text-left hover:shadow-troll-green transition"
        >
          <div className="flex items-center gap-2 mb-1">
            <Users size={18} />
            <span className="font-semibold">My Family Profile</span>
          </div>
          <p className="text-xs text-gray-300">
            See your family banner, members, roles, and contribution points.
          </p>
        </button>

        <button
          onClick={handleGoWars}
          className="troll-card p-3 text-left hover:shadow-troll-pink transition"
        >
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={18} />
            <span className="font-semibold">Family Wars</span>
          </div>
          <p className="text-xs text-gray-300">
            Challenge other families to weekly task wars and battles.
          </p>
        </button>

        <button
          onClick={handleGoChat}
          className="troll-card p-3 text-left hover:shadow-troll-glow transition"
        >
          <div className="flex items-center gap-2 mb-1">
            <Map size={18} />
            <span className="font-semibold">Family Chat & Planning</span>
          </div>
          <p className="text-xs text-gray-300">
            Plan attacks, events, and grind sessions together.
          </p>
        </button>
      </div>

      {/* Leaderboard */}
      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Trophy size={18} className="text-yellow-300" />
        Weekly Family Ranking
      </h2>

      {loading ? (
        <div className="loading-pulse text-sm text-gray-300">Loading leaderboard...</div>
      ) : rows.length === 0 ? (
        <div className="troll-card p-4 text-sm text-gray-300">
          No family tasks completed this week yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((fam, index) => (
            <div
              key={fam.family_id}
              className={`troll-card p-4 flex items-center justify-between ${
                index === 0 ? 'border border-yellow-400 shadow-[0_0_25px_rgba(255,200,60,0.5)]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 text-center font-bold text-lg">
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <Crown className="text-yellow-300 animate-pulse-neon" size={18} />
                    )}
                    <span className="font-semibold text-base">
                      {fam.family_name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 flex items-center gap-2 mt-1">
                    <Star size={14} />
                    {fam.task_count} tasks completed • {getRankName(fam.task_count)}
                  </div>
                </div>
              </div>

              {index === 0 && (
                <div className="text-right text-xs text-yellow-200">
                  <div className="neon-pill neon-pill-gold text-[10px] inline-flex items-center gap-1">
                    👑 Crowned This Week
                  </div>
                  <div className="text-[10px] text-gray-200 mt-1">
                    Gets Royal Entrance + Coin Reward
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-400 mt-6 text-center">
        Weekly reset: <span className="text-yellow-300 font-semibold">Sunday 00:00</span>.
      </div>
    </div>
  )
}
