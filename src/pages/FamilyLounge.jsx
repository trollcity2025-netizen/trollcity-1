import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  Crown, Users, Coins, TrendingUp, Target, Calendar,
  Trophy, Sword, Star, Zap, Award
} from 'lucide-react'

const FamilyLounge = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [family, setFamily] = useState(null)
  const [familyStats, setFamilyStats] = useState(null)
  const [familyTasks, setFamilyTasks] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [memberRole, setMemberRole] = useState('member')
  const [loading, setLoading] = useState(true)

  // Create Family State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateFamily = async (e) => {
    e.preventDefault()
    if (!newFamilyName.trim()) return toast.error('Family name required')
    
    setCreating(true)
    try {
      // 1. Create Family
      const { data: familyData, error: familyError } = await supabase
        .from('troll_families')
        .insert({
          name: newFamilyName,
          family_name: newFamilyName,
          leader_id: user.id,
          description: `The ${newFamilyName} family`,
          xp: 0,
          level: 1
        })
        .select()
        .single()

      if (familyError) throw familyError

      // 2. Add creator as leader
      const { error: memberError } = await supabase
        .from('family_members')
        .insert({
          family_id: familyData.id,
          user_id: user.id,
          role: 'leader',
          rank_name: 'Royal Troll',
          is_royal_troll: true
        })

      if (memberError) throw memberError

      toast.success('Family Created Successfully!')
      setShowCreateModal(false)
      
      // Optimistic update to immediately show the family interface
      setFamily(familyData)
      setMemberRole('leader')
      setFamilyStats({
        family_id: familyData.id,
        total_coins: 0,
        weekly_coins: 0,
        season_coins: 0,
        level: 1,
        xp: 0
      })
      setFamilyTasks([])
      setActivityLog([])
      
      // Background refresh to ensure everything is synced
      loadFamilyData()
    } catch (error) {
      console.error('Error creating family:', error)
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        toast.error('A family with this name already exists. Please choose another name.')
      } else {
        toast.error(error.message || 'Failed to create family')
      }
    } finally {
      setCreating(false)
    }
  }

  const generateTasks = async () => {
    if (!family || !family.id) return
    setLoading(true)
    try {
      const tasks = [
        {
          family_id: family.id,
          task_title: 'Recruit New Trolls',
          task_description: 'Grow your family by recruiting 3 new members this week.',
          reward_family_coins: 500,
          reward_family_xp: 100,
          goal_value: 3,
          current_value: 0,
          metric: 'family_members_recruited',
          status: 'active',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          family_id: family.id,
          task_title: 'Host a Clan Stream',
          task_description: 'Start a live stream representing your family.',
          reward_family_coins: 200,
          reward_family_xp: 50,
          goal_value: 1,
          current_value: 0,
          metric: 'streams_started',
          status: 'active',
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          family_id: family.id,
          task_title: 'Gift Raid',
          task_description: 'Send 5 gifts to support other trolls.',
          reward_family_coins: 300,
          reward_family_xp: 75,
          goal_value: 5,
          current_value: 0,
          metric: 'gifts_sent',
          status: 'active',
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]

      // Prefer RPC to handle RLS and schema variations server-side
      const { error: rpcError } = await supabase.rpc('create_family_tasks', { p_family_id: family.id })
      let error = rpcError
      if (rpcError && (rpcError.code === '404' || rpcError.message?.includes('function not found'))) {
        // Fallback to direct insert if RPC missing
        const { error: insertErr } = await supabase.from('family_tasks').insert(tasks)
        error = insertErr || null
      }
      
      if (error) {
        // Check for column errors (Postgres code 42703 is undefined_column)
        if (error.code === '42703') {
           console.warn('New schema failed, attempting legacy schema fallback...')
           
           const legacyTasks = tasks.map(t => ({
             family_id: t.family_id,
             title: t.task_title,
             description: t.task_description,
             category: 'General',
             task_type: 'Influence', // Required in some legacy schemas
             reward_coins: t.reward_family_coins,
             reward_xp: t.reward_family_xp,
             status: 'active',
             expires_at: t.expires_at
           }))

           const { error: legacyError } = await supabase.from('family_tasks').insert(legacyTasks)
           if (legacyError) throw legacyError
        } else {
           throw error
        }
      }
      
      // Force refresh data
      await loadFamilyData()
      toast.success('Weekly tasks generated!')
    } catch (error) {
      console.error('Error generating tasks:', error)
      toast.error(`Failed to generate tasks: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const loadFamilyData = useCallback(async () => {
    setLoading(true)
    try {
      // Step 1: Get membership first (without join to avoid relationship issues)
      const { data: membership, error: memberError } = await supabase
        .from('family_members')
        .select('family_id, role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (memberError) throw memberError

      if (membership?.family_id) {
        // Step 2: Get family details
        const { data: familyData, error: familyError } = await supabase
          .from('troll_families')
          .select('*')
          .eq('id', membership.family_id)
          .single()

        if (familyError) throw familyError

        if (familyData) {
          setFamily(familyData)
          setMemberRole(membership.role)

          const familyId = familyData.id

          // Load family stats
          const { data: stats } = await supabase
            .from('family_stats')
            .select('*')
            .eq('family_id', familyId)
            .maybeSingle()

          // If no stats exist, use defaults
          setFamilyStats(stats || {
            family_id: familyId,
            total_coins: 0,
            weekly_coins: 0,
            season_coins: 0,
            level: 1,
            xp: 0
          })

          // Load tasks, prefer active but fall back to any recent if needed
          let { data: tasks } = await supabase
            .from('family_tasks')
            .select('*')
            .eq('family_id', familyId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(5)

          if (!tasks || tasks.length === 0) {
            const { data: anyTasks } = await supabase
              .from('family_tasks')
              .select('*')
              .eq('family_id', familyId)
              .order('created_at', { ascending: false })
              .limit(5)

            tasks = anyTasks || []
          }

          setFamilyTasks(tasks || [])

          // Load recent activity
          const { data: activities } = await supabase
            .from('family_activity_log')
            .select(`
              *,
              profiles:user_profiles!family_activity_log_user_id_fkey (username, created_at)
            `)
            .eq('family_id', familyId)
            .order('created_at', { ascending: false })
            .limit(10)

          setActivityLog(activities || [])
        }
      } else {
        setFamily(null)
      }
    } catch (error) {
      console.error('Error loading family data:', error)
      // Only show error if it's not "PGRST116" (no result) which is expected if not in family
      if (error.code !== 'PGRST116') {
         toast.error(`Failed to load family: ${error.message}`)
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadFamilyData()
    }
  }, [user, loadFamilyData])

  // const contributeToTask = async (taskId) => {
  //   // This function is now deprecated for manual contribution to auto-tracked tasks
  //   // But kept for any manual tasks if they exist
  //   try {
  //     const { error } = await supabase.rpc('increment_task_progress', {
  //       p_task_id: taskId,
  //       p_increment: 1
  //     })
  //
  //     if (error) throw error
  //
  //     toast.success('Contribution recorded!')
  //     loadFamilyData() 
  //   } catch (error) {
  //     console.error('Error contributing to task:', error)
  //     toast.error('Failed to record contribution')
  //   }
  // }

  // Helper to check if task is auto-tracked
  // const isAutoTracked = (metric) => {
  //   const autoMetrics = [
  //     'family_members_recruited',
  //     'streams_started', 
  //     'gifts_sent',
  //     'wars_declared',
  //     'wars_won'
  //   ]
  //   return autoMetrics.includes(metric)
  // }

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
        <div className="max-w-4xl mx-auto text-center mt-20">
          <Crown className="w-16 h-16 mx-auto mb-6 text-purple-400" />
          <h1 className="text-3xl font-bold mb-4">Not in a Family</h1>
          <p className="text-gray-300 mb-8 max-w-lg mx-auto">
            Join an existing family or create your own legacy. Lead your family to glory in the Troll City wars!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/family/browse')}
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold transition-colors border border-zinc-700"
            >
              Browse Families
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors flex items-center gap-2 justify-center"
            >
              <Crown className="w-5 h-5" />
              Create New Family
            </button>
          </div>
        </div>

        {/* Create Family Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-purple-500/30 rounded-2xl p-6 max-w-md w-full relative">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                ✕
              </button>
              
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Crown className="text-purple-400" />
                Create Troll Family
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Establish your own family. You will become the leader and Royal Troll.
              </p>

              <form onSubmit={handleCreateFamily} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Family Name
                  </label>
                  <input
                    type="text"
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    placeholder="e.g. The Bridge Keepers"
                    className="w-full bg-black/50 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
                    maxLength={30}
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={creating || !newFamilyName.trim()}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>Creating...</>
                    ) : (
                      <>
                        <Crown className="w-5 h-5" />
                        Establish Family
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      {activity.profiles ? (
                        <UserNameWithAge
                          user={{
                            username: activity.profiles.username,
                            id: activity.user_id,
                            created_at: activity.profiles.created_at
                          }}
                        />
                      ) : (
                        'System'
                      )}
                      <span>• {formatTimeAgo(activity.created_at)}</span>
                    </div>
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
              <div className="text-center py-6">
                <p className="text-gray-400 mb-4">No active tasks</p>
                {['leader', 'officer'].includes(memberRole) && (
                  <button
                    onClick={generateTasks}
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold text-white transition-all flex items-center gap-2 mx-auto"
                  >
                    <Target className="w-4 h-4" />
                    Generate Weekly Tasks
                  </button>
                )}
              </div>
            ) : (
              familyTasks.map((task) => {
                const goal = task.goal_value ?? task.target_value ?? 1
                const current = task.current_value ?? task.progress_value ?? 0
                const progress = goal > 0 ? (current / goal) * 100 : 0
                const title = task.task_title || task.title || 'Family Task'
                const description = task.task_description || task.description || ''
                const rewardCoins = task.reward_family_coins ?? task.reward_coins ?? 0
                const rewardXp = task.reward_family_xp ?? task.reward_xp ?? 0

                return (
                  <div key={task.id} className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-purple-400">{title}</h3>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-yellow-400">+{rewardCoins}</span>
                        <Star className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-400">+{rewardXp} XP</span>
                      </div>
                    </div>
                    {description && (
                      <p className="text-sm text-gray-300 mb-3">{description}</p>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">
                        Progress: {current} / {goal}
                      </span>
                      <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-zinc-700 rounded-full h-2 mb-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>
                    {/* Contribute button removed as requested */}
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
