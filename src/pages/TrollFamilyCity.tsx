// src/pages/TrollFamilyCity.tsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import {
  Trophy,
  Users,
  Crown,
  Star,
  Gift,
  Radio,
  Eye,
  Home,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'

export default function TrollFamilyCity() {
  const { profile } = useAuthStore()
  const [families, setFamilies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFamilyLeaderboard()
  }, [])

  const loadFamilyLeaderboard = async () => {
    setLoading(true)

    const { data, error } = await supabase.rpc('get_weekly_family_task_counts')

    if (error) {
      console.error(error)
      toast.error('Failed to load Family City')
      setLoading(false)
      return
    }

    setFamilies(data || [])
    setLoading(false)
  }

  const getRankInfo = (tasks: number) => {
    if (tasks >= 30)
      return { name: 'Royal Family', color: 'text-yellow-300', glow: 'shadow-[0_0_15px_rgba(255,215,0,0.6)]', tag: 'ROYAL' }
    if (tasks >= 20)
      return { name: 'Diamond Clan', color: 'text-blue-400', glow: 'shadow-[0_0_15px_rgba(0,128,255,0.5)]', tag: 'DIAMOND' }
    if (tasks >= 15)
      return { name: 'Platinum Squad', color: 'text-pink-400', glow: 'shadow-[0_0_15px_rgba(255,105,180,0.5)]', tag: 'PLATINUM' }
    if (tasks >= 10)
      return { name: 'Gold Tribe', color: 'text-orange-400', glow: 'shadow-[0_0_15px_rgba(255,165,0,0.5)]', tag: 'GOLD' }
    if (tasks >= 5)
      return { name: 'Silver House', color: 'text-gray-200', glow: 'shadow-[0_0_15px_rgba(225,225,225,0.5)]', tag: 'SILVER' }
    return { name: 'Bronze Family', color: 'text-gray-500', glow: '', tag: 'BRONZE' }
  }

  const userFamily = (profile as any)?.troll_family_name || null

  return (
    <div
      className="min-h-screen p-6 text-white relative"
      style={{
        background:
          'radial-gradient(circle at top, #3b0764 0, #020014 40%, #000000 100%)'
      }}
    >
      {/* HEADER */}
      <h1 className="text-4xl font-extrabold mb-2 flex items-center gap-3">
        <Sparkles className="text-purple-300 animate-pulse" />
        Troll Family City
      </h1>

      <p className="text-gray-300 text-sm mb-6 max-w-xl">
        The Troll Families of Troll City compete weekly. Top family gets{' '}
        <span className="text-yellow-300 font-bold">10,000 Free Coins</span> +
        Royal Badge + City Crown 👑
      </p>

      {userFamily && (
        <div className="mb-5 p-3 bg-purple-800/30 border border-purple-600/50 rounded-lg text-sm">
          You are part of <span className="font-bold text-purple-300">{userFamily}</span>. 
          Your Family progress is automatically tracked.
        </div>
      )}

      {/* LEADERBOARD SECTION */}
      {loading ? (
        <div className="text-gray-400 text-sm">Loading Family City...</div>
      ) : families.length === 0 ? (
        <div>No families found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {families.map((fam: any, index: number) => {
            const rank = getRankInfo(fam.task_count)

            return (
              <div
                key={fam.family_id}
                className={`p-5 rounded-2xl bg-black/50 border border-purple-800/40 hover:border-purple-400 transition-all
                  ${rank.glow} ${userFamily === fam.family_name ? 'border-purple-400' : ''}`}
              >
                {/* TOP LINE */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <Crown className="text-yellow-300 animate-pulse" size={22} />
                    )}
                    <h2 className="text-xl font-bold">{fam.family_name}</h2>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-purple-800/40 border border-purple-500/40">
                    Rank #{index + 1}
                  </div>
                </div>

                {/* RANK NAME DISPLAY */}
                <div className={`${rank.color} font-semibold text-sm mb-1`}>
                  {rank.name}
                </div>

                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Star size={14} /> {fam.task_count} tasks completed this week
                </div>

                {/* DATA ROW */}
                <div className="mt-4 grid grid-cols-3 text-center text-xs text-gray-300">
                  <div>
                    <Users className="mx-auto mb-1 text-purple-300" size={18} />
                    {fam.member_count || 1} members
                  </div>
                  <div>
                    <Gift className="mx-auto mb-1 text-yellow-300" size={18} />
                    {fam.earnings || 0} coins earned
                  </div>
                  <div>
                    <Radio className="mx-auto mb-1 text-pink-300" size={18} />
                    {fam.live_count || 0} live now
                  </div>
                </div>

                {/* BUTTONS */}
                <div className="mt-4 flex justify-between">
                  <button className="text-xs px-3 py-1 rounded-full border border-gray-600 hover:bg-purple-700/20">
                    Visit House
                  </button>
                  <button className="text-xs px-3 py-1 rounded-full border border-purple-600 hover:bg-purple-700/20">
                    Family Streams
                  </button>
                </div>

                {index === 0 && (
                  <div className="mt-3 text-yellow-200 text-[11px] bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/40 flex justify-between">
                    👑 Crowned Family of The Week
                    <button className="underline text-[10px]">
                      Distribute Reward
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* FOOTER */}
      <div className="text-xs text-gray-500 mt-6 text-center">
        Weekly reset every Sunday at midnight.
      </div>
    </div>
  )
}
