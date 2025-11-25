import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Trophy, Coins, Video, Users } from 'lucide-react'

export default function Leaderboard() {
  const [topUsers, setTopUsers] = useState<any[]>([])
  const [topStreams, setTopStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, username, total_earned_coins, paid_coin_balance')
          .order('total_earned_coins', { ascending: false })
          .limit(20)
        setTopUsers(users || [])
        const { data: streams } = await supabase
          .from('streams')
          .select('id, title, total_gifts_coins, current_viewers')
          .order('total_gifts_coins', { ascending: false })
          .limit(20)
        setTopStreams(streams || [])
      } catch {
        setTopUsers([]); setTopStreams([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-6 h-6 text-yellow-300" />
          <h1 className="text-2xl font-extrabold">Leaderboard</h1>
        </div>
        {loading ? (
          <div className="text-gray-400">Loading…</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-purple-300" /> Top Earners</h2>
              <div className="space-y-2">
                {topUsers.map((u, i) => (
                  <div key={u.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><span className="text-gray-400">{i+1}.</span> @{u.username}</div>
                    <div className="flex items-center gap-1 text-yellow-300"><Coins className="w-4 h-4" /> {u.total_earned_coins || 0}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Video className="w-5 h-5 text-green-300" /> Top Streams (Gift Coins)</h2>
              <div className="space-y-2">
                {topStreams.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><span className="text-gray-400">{i+1}.</span> {s.title || 'Untitled'}</div>
                    <div className="flex items-center gap-1 text-yellow-300"><Coins className="w-4 h-4" /> {s.total_gifts_coins || 0}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
