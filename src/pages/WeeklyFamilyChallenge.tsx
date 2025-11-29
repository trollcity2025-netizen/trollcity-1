import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Trophy, Users } from 'lucide-react'
import { toast } from 'sonner'

export default function WeeklyFamilyChallenge() {
  const [loading, setLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const rewardPool = 10000

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_weekly_family_task_counts')
      if (error) throw error
      setLeaderboard(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load weekly challenge')
    } finally {
      setLoading(false)
    }
  }

  const distributeRewards = async (winnerFamilyId: string) => {
    try {
      const { data: members } = await supabase
        .from('troll_family_members')
        .select('user_id')
        .eq('family_id', winnerFamilyId)

      if (!members || members.length === 0) return toast.error('No family members found')

      const splitAmount = Math.floor(rewardPool / members.length)

      const updates = members.map((m) =>
        supabase.rpc('add_free_coins', {
          p_user_id: m.user_id,
          p_amount: splitAmount,
        })
      )
      await Promise.all(updates)
      await supabase.rpc('grant_family_crown', {
        p_family_id: winnerFamilyId,
      })

      toast.success(`👑 ${leaderboard[0].family_name} is now crowned Family of the Week!`)
    } catch (error) {
      console.error(error)
      toast.error('Failed to distribute rewards')
    }
  }

  return (
    <div className="min-h-screen p-6 text-white tc-cosmic-bg">
      <h1 className="text-3xl font-extrabold gradient-text-green-pink mb-6 flex gap-2 items-center">
        🏁 Weekly Troll Family Challenge
      </h1>

      <p className="text-sm text-gray-300 mb-4">
        Every Sunday at midnight, the family with the **most completed tasks** wins
        <span className="text-green-400 font-bold"> 10,000 free coins </span>
        split equally between all members.
      </p>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-black/40 p-4 rounded-xl shadow-lg">
          {leaderboard.length === 0 ? (
            <p>No completed tasks yet this week</p>
          ) : (
            leaderboard.map((fam, index) => (
              <div
                key={fam.family_id}
                className={`p-3 rounded-lg mb-2 flex justify-between ${
                  index === 0 ? 'bg-purple-800/50 neon-border-green' : 'bg-gray-800'
                }`}
              >
                <div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    {index === 0 && <Trophy className="text-yellow-400" />}
                    {fam.family_name}
                  </div>
                  <div className="text-sm text-gray-300 flex items-center gap-1">
                    <Users size={14} /> {fam.task_count} tasks completed
                  </div>
                </div>

                {index === 0 && (
                  <button
                    className="gaming-button-pink px-4 py-2 rounded"
                    onClick={() => distributeRewards(fam.family_id)}
                  >
                    Distribute Reward
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6">
        Winner resets every week. Tasks auto-refresh Friday 00:00.
      </p>
    </div>
  )
}
