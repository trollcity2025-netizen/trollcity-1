import React, { useState, useEffect, useCallback } from 'react'
import { supabase, UserProfile } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { declareWar, completeWar } from '../lib/familyWars'
import { toast } from 'sonner'
import {
  Sword, Clock, Target, Trophy
} from 'lucide-react'

const FamilyWarsHub = ({ user: _authUser }: { user?: UserProfile | null }) => {
  const { user } = useAuthStore()
  const [family, setFamily] = useState(null)
  const [memberRole, setMemberRole] = useState('member')
  const [currentWar, setCurrentWar] = useState(null)
  const [warScores, setWarScores] = useState([])
  const [availableFamilies, setAvailableFamilies] = useState([])
  const [warHistory, setWarHistory] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [creatingWar, setCreatingWar] = useState(false)

  const loadWarData = useCallback(async () => {
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
          .select('id, name, emblem_url')
          .eq('id', membership.family_id)
          .maybeSingle()

        if (familyError) throw familyError

        if (familyData) {
          setFamily(familyData)
          setMemberRole(membership.role)

          const familyId = familyData.id

          // Load current active war
          const { data: war } = await supabase
            .from('family_wars')
            .select(`
              *,
              family_a:troll_families!family_wars_family_a_id_fkey (
                id, name, emblem_url
              ),
              family_b:troll_families!family_wars_family_b_id_fkey (
                id, name, emblem_url
              )
            `)
            .or(`family_a_id.eq.${familyId},family_b_id.eq.${familyId}`)
            .in('status', ['pending', 'active'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (war) {
            // Check if war has ended but status is still active
            const endsAt = new Date(war.end_time || war.ends_at)
            if (war.status === 'active' && endsAt <= new Date()) {
              await completeWar(war.id)
              loadWarData() // Reload to get updated status
              return
            }

            setCurrentWar(war)

            // Load war scores
            const { data: scores } = await supabase
              .from('family_war_scores')
              .select('*')
              .eq('war_id', war.id)

            setWarScores(scores || [])
          }

          // Load available families for war creation
          const { data: families } = await supabase
            .from('troll_families')
            .select('id, name, emblem_url')
            .neq('id', familyId)
            .limit(20)

          setAvailableFamilies(families || [])

          // Load weekly tasks
          const { data: tasks } = await supabase
            .from('family_tasks')
            .select('*')
            .eq('family_id', familyId)
            .order('tier', { ascending: true })
            .order('task_type', { ascending: true })

          setWeeklyTasks(tasks || [])

          // Load war history
          const { data: history } = await supabase
            .from('family_wars')
            .select(`
              *,
              family_a:troll_families!family_wars_family_a_id_fkey (
                id, name, emblem_url
              ),
              family_b:troll_families!family_wars_family_b_id_fkey (
                id, name, emblem_url
              )
            `)
            .or(`family_a_id.eq.${familyId},family_b_id.eq.${familyId}`)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(10)

          setWarHistory(history || [])
        }
      } else {
        setFamily(null)
      }
    } catch (error) {
      console.error('Error loading war data:', error)
      toast.error('Failed to load war data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadWarData()
    }
  }, [user, loadWarData])

  const generateTasks = async () => {
    if (!family || !family.id) return
    setLoading(true)
    try {
      // Use RPC to generate comprehensive tasks including war tasks
      const { error: rpcError } = await supabase.rpc('create_family_tasks', { p_family_id: family.id })
      
      if (rpcError) {
        console.warn('RPC create_family_tasks failed, falling back to manual insert:', rpcError)
        
        // Fallback tasks if RPC fails
        const tasks = [
          {
            family_id: family.id,
            task_title: 'Declare War',
            task_description: 'Declare war on a rival family.',
            reward_family_coins: 300,
            reward_family_xp: 75,
            goal_value: 1,
            current_value: 0,
            metric: 'wars_declared',
            status: 'active',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            family_id: family.id,
            task_title: 'First Blood',
            task_description: 'Win your first Family War of the week.',
            reward_family_coins: 1000,
            reward_family_xp: 300,
            goal_value: 1,
            current_value: 0,
            metric: 'wars_won',
            status: 'active',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            family_id: family.id,
            task_title: 'War Machine',
            task_description: 'Win 3 Family Wars.',
            reward_family_coins: 3000,
            reward_family_xp: 1000,
            goal_value: 3,
            current_value: 0,
            metric: 'wars_won',
            status: 'active',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]

        const { error: insertErr } = await supabase.from('family_tasks').insert(tasks)
        if (insertErr) throw insertErr
      }
      
      toast.success('Weekly war tasks generated!')
      loadWarData() // Refresh data
    } catch (error) {
      console.error('Error generating tasks:', error)
      toast.error(`Failed to generate tasks: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const createWar = async (opponentFamilyId, durationHours = 2) => {
    if (!family || memberRole === 'member') {
      toast.error('Only family leaders and officers can declare wars')
      return
    }

    setCreatingWar(true)
    try {
      const { success, error } = await declareWar(family.id, opponentFamilyId, user.id, durationHours)
      
      if (!success) throw error

      toast.success(`War declared against ${availableFamilies.find(f => f.id === opponentFamilyId)?.name}!`)
      loadWarData() // Refresh data
    } catch (error) {
      console.error('Error creating war:', error)
      toast.error('Failed to declare war')
    } finally {
      setCreatingWar(false)
    }
  }

  const endWar = async () => {
    if (!currentWar || memberRole === 'member') return

    try {
      const { success, error } = await completeWar(currentWar.id)

      if (!success) throw error

      toast.success('War completed!')
      setCurrentWar(null)
      setWarScores([])
      loadWarData() // Refresh data
    } catch (error) {
      console.error('Error ending war:', error)
      toast.error('Failed to end war')
    }
  }

  const formatTimeLeft = (endTime) => {
    const now = new Date()
    const end = new Date(endTime)
    const diffMs = end.getTime() - now.getTime()

    if (diffMs <= 0) return '0m'

    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    return `${hours}h ${minutes}m`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <Sword className="animate-spin w-8 h-8 mx-auto mb-4 text-red-400" />
          <p>Loading war hub...</p>
        </div>
      </div>
    )
  }

  if (!family) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto text-center">
          <Sword className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h1 className="text-3xl font-bold mb-4">Family Wars Hub</h1>
          <p className="text-gray-300 mb-6">
            Join a family to participate in epic family battles!
          </p>
          <button
            onClick={() => window.location.href = '/family/browse'}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Browse Families
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Sword className="w-10 h-10 text-red-400" />
            FAMILY WARS HUB
          </h1>
          <p className="text-gray-300">Battle other families for glory and rewards</p>
        </div>

        {/* Current War */}
        {currentWar && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-red-500/50">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-red-400 mb-2">⚔️ ACTIVE WAR ⚔️</h2>
              <p className="text-gray-300">
                {currentWar.status === 'pending' ? 'War begins' : 'War ends'} in {formatTimeLeft(currentWar.status === 'pending' ? (currentWar.start_time || currentWar.starts_at) : (currentWar.end_time || currentWar.ends_at))}
              </p>
            </div>

            {/* War Participants */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Family A */}
              <div className={`p-4 rounded-lg border-2 ${
                currentWar.family_a_id === family.id ? 'border-purple-500 bg-purple-900/20' : 'border-zinc-700'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {currentWar.family_a.emblem_url && (
                    <img
                      src={currentWar.family_a.emblem_url}
                      alt={`${currentWar.family_a.name} emblem`}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="font-bold">{currentWar.family_a.name}</span>
                  {currentWar.family_a_id === family.id && <span className="text-purple-400">(Your Family)</span>}
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {(warScores.find(s => s.family_id === currentWar.family_a_id)?.score || 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">War Points</div>
              </div>

              {/* VS */}
              <div className="flex items-center justify-center">
                <div className="text-4xl font-bold text-red-400">VS</div>
              </div>

              {/* Family B */}
              <div className={`p-4 rounded-lg border-2 ${
                currentWar.family_b_id === family.id ? 'border-purple-500 bg-purple-900/20' : 'border-zinc-700'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {currentWar.family_b.emblem_url && (
                    <img
                      src={currentWar.family_b.emblem_url}
                      alt={`${currentWar.family_b.name} emblem`}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="font-bold">{currentWar.family_b.name}</span>
                  {currentWar.family_b_id === family.id && <span className="text-purple-400">(Your Family)</span>}
                </div>
                <div className="text-2xl font-bold text-red-400">
                  {(warScores.find(s => s.family_id === currentWar.family_b_id)?.score || 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">War Points</div>
              </div>
            </div>

            {/* War Actions */}
            {memberRole !== 'member' && currentWar.status === 'active' && (
              <div className="text-center">
                <button
                  onClick={endWar}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
                >
                  ⚔️ End War & Declare Winner
                </button>
              </div>
            )}
          </div>
        )}

        {/* Weekly Tasks */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Weekly War Tasks
          </h2>
          <div className="space-y-4">
             {weeklyTasks.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-4">No active tasks. Tasks refresh weekly.</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {weeklyTasks.map(task => (
                      <div key={task.id} className={`p-4 rounded-lg border ${task.completed ? 'bg-green-900/20 border-green-500/30' : 'bg-zinc-800 border-zinc-700'}`}>
                         <div className="flex justify-between items-start mb-2">
                            <div>
                               <h3 className="font-bold text-white text-sm">{task.task_type.replace(/_/g, ' ').toUpperCase()} <span className="text-[10px] text-gray-400 bg-zinc-700 px-1.5 py-0.5 rounded ml-2">Tier {task.tier}</span></h3>
                               <p className="text-xs text-gray-300 mt-1">{task.description}</p>
                            </div>
                            {task.completed && <span className="text-green-400 font-bold text-[10px] bg-green-900/40 px-2 py-1 rounded">COMPLETED</span>}
                         </div>
                         
                         {/* Progress Bar */}
                         <div className="w-full bg-zinc-700 h-1.5 rounded-full overflow-hidden mb-2 mt-2">
                            <div 
                              className={`h-full ${task.completed ? 'bg-green-500' : 'bg-purple-500'}`} 
                              style={{ width: `${Math.min(100, (task.current_count / task.target_count) * 100)}%` }}
                            />
                         </div>
                         <div className="flex justify-between text-[10px] text-gray-400">
                            <span>Progress: {task.current_count} / {task.target_count}</span>
                            <span>Reward: {task.reward_xp} XP • {task.reward_coins} Coins</span>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>
        </div>

        {/* Declare War */}
        {!currentWar && memberRole !== 'member' && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-red-400" />
              Declare War
            </h2>

            {availableFamilies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableFamilies.slice(0, 6).map((opponentFamily) => (
                  <div key={opponentFamily.id} className="bg-zinc-800 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {opponentFamily.emblem_url && (
                        <img
                          src={opponentFamily.emblem_url}
                          alt={`${opponentFamily.name} emblem`}
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span className="font-semibold">{opponentFamily.name}</span>
                    </div>
                    <button
                      onClick={() => createWar(opponentFamily.id)}
                      disabled={creatingWar}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors text-sm"
                    >
                      {creatingWar ? 'Declaring...' : '⚔️ Declare War'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 bg-zinc-800/50 rounded-lg border border-zinc-700 border-dashed">
                <p>No other families found to challenge.</p>
                <p className="text-sm mt-2">Wait for more families to join Troll City!</p>
              </div>
            )}
          </div>
        )}

        {/* War History */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            War History
          </h2>

          <div className="space-y-3">
            {warHistory.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No war history yet</p>
            ) : (
              warHistory.map((war) => {
                const isWinner = war.winner_family_id === family.id
                const opponent = war.family_a_id === family.id ? war.family_b : war.family_a

                return (
                  <div key={war.id} className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      {opponent.emblem_url && (
                        <img
                          src={opponent.emblem_url}
                          alt={`${opponent.name} emblem`}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-semibold">vs {opponent.name}</p>
                        <p className="text-sm text-gray-400">
                          {new Date(war.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {war.winner_family_id ? (
                        <div className={`font-bold ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                          {isWinner ? '🏆 Victory' : '💀 Defeat'}
                        </div>
                      ) : (
                        <div className="font-bold text-gray-400">Draw</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* War Rules */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h3 className="text-lg font-semibold mb-3 text-red-400">⚔️ War Rules & Rewards</h3>
          <div className="space-y-2 text-zinc-300 text-sm">
            <p>• <strong>Duration:</strong> Wars last 30 minutes to 2 hours</p>
            <p>• <strong>Scoring:</strong> Points earned from member activity during war</p>
            <p>• <strong>Winner Rewards:</strong> 1,000 family coins + 100 XP</p>
            <p>• <strong>Participation Bonus:</strong> 500 coins + 25 XP for both families</p>
            <p>• <strong>Leadership:</strong> Only family leaders and officers can declare wars</p>
            <p>• <strong>Cooldown:</strong> Families can only be in one war at a time</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FamilyWarsHub
