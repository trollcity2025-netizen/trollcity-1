import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  Sword, Shield, Trophy, Clock, Users,
  Target, Zap, Crown, AlertTriangle
} from 'lucide-react'

const FamilyWarsHub = () => {
  const { user, profile } = useAuthStore()
  const [family, setFamily] = useState(null)
  const [memberRole, setMemberRole] = useState('member')
  const [currentWar, setCurrentWar] = useState(null)
  const [warScores, setWarScores] = useState([])
  const [availableFamilies, setAvailableFamilies] = useState([])
  const [warHistory, setWarHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [creatingWar, setCreatingWar] = useState(false)

  useEffect(() => {
    if (user) {
      loadWarData()
    }
  }, [user])

  const loadWarData = async () => {
    setLoading(true)
    try {
      // Get user's family
      const { data: membership } = await supabase
        .from('family_members')
        .select(`
          role,
          troll_families (
            id,
            name,
            emblem_url
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (membership?.troll_families) {
        setFamily(membership.troll_families)
        setMemberRole(membership.role)

        const familyId = membership.troll_families.id

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
          .single()

        if (war) {
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
    } catch (error) {
      console.error('Error loading war data:', error)
      toast.error('Failed to load war data')
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
      const startTime = new Date()
      const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000)

      // Create war
      const { data: war, error: warError } = await supabase
        .from('family_wars')
        .insert({
          family_a_id: family.id,
          family_b_id: opponentFamilyId,
          status: 'pending',
          created_by: user.id,
          starts_at: startTime.toISOString(),
          ends_at: endTime.toISOString()
        })
        .select()
        .single()

      if (warError) throw warError

      // Create initial scores
      const { error: scoresError } = await supabase
        .from('family_war_scores')
        .insert([
          { war_id: war.id, family_id: family.id, score: 0 },
          { war_id: war.id, family_id: opponentFamilyId, score: 0 }
        ])

      if (scoresError) throw scoresError

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
      // Determine winner
      const familyAScore = warScores.find(s => s.family_id === currentWar.family_a_id)?.score || 0
      const familyBScore = warScores.find(s => s.family_id === currentWar.family_b_id)?.score || 0

      let winnerId = null
      if (familyAScore > familyBScore) {
        winnerId = currentWar.family_a_id
      } else if (familyBScore > familyAScore) {
        winnerId = currentWar.family_b_id
      }

      // Update war
      const { error: warError } = await supabase
        .from('family_wars')
        .update({
          status: 'completed',
          winner_family_id: winnerId
        })
        .eq('id', currentWar.id)

      if (warError) throw warError

      // Award bonuses
      const winnerBonus = 10000 // 10k coins + 100 XP
      const loserBonus = 2500   // 2.5k coins + 25 XP

      if (winnerId) {
        await supabase.rpc('increment_family_stats', {
          p_family_id: winnerId,
          p_coin_bonus: winnerBonus,
          p_xp_bonus: 100
        })
      }

      // Give participation bonus to both families
      await supabase.rpc('increment_family_stats', {
        p_family_id: currentWar.family_a_id,
        p_coin_bonus: winnerId === currentWar.family_a_id ? 0 : loserBonus,
        p_xp_bonus: winnerId === currentWar.family_a_id ? 0 : 25
      })

      await supabase.rpc('increment_family_stats', {
        p_family_id: currentWar.family_b_id,
        p_coin_bonus: winnerId === currentWar.family_b_id ? 0 : loserBonus,
        p_xp_bonus: winnerId === currentWar.family_b_id ? 0 : 25
      })

      // Log results
      const winnerName = winnerId
        ? (winnerId === currentWar.family_a_id ? currentWar.family_a.name : currentWar.family_b.name)
        : 'Draw'

      await supabase
        .from('family_activity_log')
        .insert([
          {
            family_id: currentWar.family_a_id,
            event_type: winnerId === currentWar.family_a_id ? 'war_win' : 'war_loss',
            event_message: `War vs ${currentWar.family_b.name}: ${winnerName} wins! (+${winnerId === currentWar.family_a_id ? winnerBonus : loserBonus} coins)`
          },
          {
            family_id: currentWar.family_b_id,
            event_type: winnerId === currentWar.family_b_id ? 'war_win' : 'war_loss',
            event_message: `War vs ${currentWar.family_a.name}: ${winnerName} wins! (+${winnerId === currentWar.family_b_id ? winnerBonus : loserBonus} coins)`
          }
        ])

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
    const diffMs = end - now

    if (diffMs <= 0) return 'Ended'

    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    return `${hours}h ${minutes}m left`
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
            onClick={() => window.location.href = '/family'}
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
                {currentWar.status === 'pending' ? 'War begins' : 'War ends'} in {formatTimeLeft(currentWar.status === 'pending' ? currentWar.starts_at : currentWar.ends_at)}
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

        {/* Declare War */}
        {!currentWar && memberRole !== 'member' && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-red-400" />
              Declare War
            </h2>

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
            <p>• <strong>Winner Rewards:</strong> 10,000 family coins + 100 XP</p>
            <p>• <strong>Participation Bonus:</strong> 2,500 coins + 25 XP for both families</p>
            <p>• <strong>Leadership:</strong> Only family leaders and officers can declare wars</p>
            <p>• <strong>Cooldown:</strong> Families can only be in one war at a time</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FamilyWarsHub