import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  Crown, Users, Coins, TrendingUp, Target, Calendar,
  Trophy, Shield, Sword, Star, Zap, Award
} from 'lucide-react'

const FamilyLounge = () => {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [family, setFamily] = useState(null)
  const [familyStats, setFamilyStats] = useState(null)
  const [familyTasks, setFamilyTasks] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [memberRole, setMemberRole] = useState('member')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadFamilyData()
    }
  }, [user])

  const loadFamilyData = async () => {
    setLoading(true)
    try {
      // Get user's family membership
      const { data: membership } = await supabase
        .from('family_members')
        .select(`
          role,
          troll_families (
            id,
            name,
            emblem_url,
            banner_url,
            description,
            leader_id
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (membership?.troll_families) {
        setFamily(membership.troll_families)
        setMemberRole(membership.role)

        const familyId = membership.troll_families.id

        // Load family stats
        const { data: stats } = await supabase
          .from('family_stats')
          .select('*')
          .eq('family_id', familyId)
          .single()

        setFamilyStats(stats)

        // Load active tasks
        const { data: tasks } = await supabase
          .from('family_tasks')
          .select('*')
          .eq('family_id', familyId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(5)

        setFamilyTasks(tasks || [])

        // Load recent activity
        const { data: activities } = await supabase
          .from('family_activity_log')
          .select(`
            *,
            profiles:user_id (username)
          `)
          .eq('family_id', familyId)
          .order('created_at', { ascending: false })
          .limit(10)

        setActivityLog(activities || [])
      }
    } catch (error) {
      console.error('Error loading family data:', error)
      toast.error('Failed to load family data')
    } finally {
      setLoading(false)
    }
  }

  const contributeToTask = async (taskId) => {
    try {
      // Increment task progress (simplified - in real implementation this would be based on actual metrics)
      const { error } = await supabase.rpc('increment_task_progress', {
        p_task_id: taskId,
        p_increment: 1
      })

      if (error) throw error

      toast.success('Contribution recorded!')
      loadFamilyData() // Refresh data
    } catch (error) {
      console.error('Error contributing to task:', error)
      toast.error('Failed to record contribution')
    }
  }

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'coins_earned': return <Coins className="w-4 h-4 text-yellow-400" />
      case 'level_up': return <TrendingUp className="w-4 h-4 text-green-400" />
      case 'task_completed': return <Target className="w-4 h-4 text-blue-400" />
      case 'war_win': return <Trophy className="w-4 h-4 text-purple-400" />
      case 'war_loss': return <Sword className="w-4 h-4 text-red-400" />
      case 'shop_purchase': return <Award className="w-4 h-4 text-pink-400" />
      default: return <Star className="w-4 h-4 text-gray-400" />
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now - time
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <Crown className="animate-spin w-8 h-8 mx-auto mb-4 text-purple-400" />
          <p>Loading family lounge...</p>
        </div>
      </div>
    )
  }

  if (!family) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto text-center">
          <Crown className="w-16 h-16 mx-auto mb-6 text-purple-400" />
          <h1 className="text-3xl font-bold mb-4">Not in a Family</h1>
          <p className="text-gray-300 mb-6">
            Join or create a Troll Family to access the family lounge and participate in epic family battles!
          </p>
          <button
            onClick={() => navigate('/family')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Browse Families
          </button>
        </div>
      </div>
    )
  }

  const currentXP = familyStats?.xp || 0
  const currentLevel = familyStats?.level || 1
  const nextLevelXP = currentLevel * currentLevel * 1000
  const xpProgress = (currentXP / nextLevelXP) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            {family.emblem_url && (
              <img
                src={family.emblem_url}
                alt={`${family.name} emblem`}
                className="w-16 h-16 rounded-full border-2 border-purple-400"
              />
            )}
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Crown className="w-8 h-8 text-yellow-400" />
                {family.name}
              </h1>
              <p className="text-gray-300">Level {currentLevel} Family</p>
            </div>
          </div>
          <p className="text-purple-300 text-sm">
            You are in {family.name} • Role: {memberRole}
          </p>
        </div>

        {/* XP Progress Bar */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Family XP Progress</span>
            <span className="text-sm text-purple-400">{currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(xpProgress, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {nextLevelXP - currentXP} XP needed for Level {currentLevel + 1}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Total Coins</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {(familyStats?.total_coins || 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">Weekly Coins</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {(familyStats?.weekly_coins || 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-gray-400">Season Coins</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {(familyStats?.season_coins || 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Family Level</span>
            </div>
            <p className="text-2xl font-bold text-green-400">
              Level {currentLevel}
            </p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Recent Activity
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {activityLog.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No recent activity</p>
            ) : (
              activityLog.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                  {getEventIcon(activity.event_type)}
                  <div className="flex-1">
                    <p className="text-sm text-gray-300">{activity.event_message}</p>
                    <p className="text-xs text-gray-500">
                      {activity.profiles?.username || 'System'} • {formatTimeAgo(activity.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Tasks */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            Active Family Tasks
          </h2>
          <div className="space-y-4">
            {familyTasks.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No active tasks</p>
            ) : (
              familyTasks.map((task) => {
                const progress = (task.current_value / task.goal_value) * 100
                return (
                  <div key={task.id} className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-purple-400">{task.task_title}</h3>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-yellow-400">+{task.reward_family_coins}</span>
                        <Star className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-400">+{task.reward_family_xp} XP</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 mb-3">{task.task_description}</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">
                        Progress: {task.current_value} / {task.goal_value}
                      </span>
                      <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-zinc-700 rounded-full h-2 mb-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>
                    {memberRole !== 'member' && (
                      <button
                        onClick={() => contributeToTask(task.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Contribute
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/family/wars-hub')}
            className="p-4 bg-zinc-900 border border-red-500/50 rounded-lg hover:bg-zinc-800 transition-colors text-left"
          >
            <Sword className="w-6 h-6 text-red-400 mb-2" />
            <p className="font-semibold">Family War Hub</p>
            <p className="text-sm opacity-70">Battle other families for glory</p>
          </button>

          <button
            onClick={() => navigate('/family/leaderboard')}
            className="p-4 bg-zinc-900 border border-yellow-500/50 rounded-lg hover:bg-zinc-800 transition-colors text-left"
          >
            <Trophy className="w-6 h-6 text-yellow-400 mb-2" />
            <p className="font-semibold">Family Leaderboard</p>
            <p className="text-sm opacity-70">See top families globally</p>
          </button>

          <button
            onClick={() => navigate('/family/shop')}
            className="p-4 bg-zinc-900 border border-green-500/50 rounded-lg hover:bg-zinc-800 transition-colors text-left"
          >
            <Award className="w-6 h-6 text-green-400 mb-2" />
            <p className="font-semibold">Family Shop</p>
            <p className="text-sm opacity-70">Unlock exclusive perks</p>
          </button>
        </div>
      </div>
    </div>
  )
}

export default FamilyLounge