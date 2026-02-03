import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import UserNameWithAge from '../../components/UserNameWithAge'
import { toast } from 'sonner'
import {
  Crown,
  Users,
  Trophy,
  TrendingUp,
  UserPlus,
  UserMinus,
  Edit,
  Star
} from 'lucide-react'

interface RoyalFamilyStatus {
  admin_id: string
  current_wife: any
  current_husband: any
  gift_leaderboard: any[]
  honorary_members: any[]
}

interface LeaderboardEntry {
  user_id: string
  username: string
  total_coins: number
  gender: string
  last_gift_at: string
  rank: number
  age_days?: number
}

export default function TrollFamily() {
  const [familyStatus, setFamilyStatus] = useState<RoyalFamilyStatus | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [honoraryMembers, setHonoraryMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberUsername, setNewMemberUsername] = useState('')
  const [newMemberTitle, setNewMemberTitle] = useState('Honorary Family Member')
  const [usersCreatedAt, setUsersCreatedAt] = useState<Record<string, string>>({})

  const loadFamilyData = React.useCallback(async () => {
    try {
      setLoading(true)

      // Get royal family status for all admins
      const { data: statusData, error: statusError } = await supabase.rpc('get_royal_family_status')

      if (statusError) throw statusError

      // For now, we'll focus on the first admin (assuming single admin system)
      // In a multi-admin system, this would need to be filtered by current admin
      const adminStatus = statusData?.[0]
      if (adminStatus) {
        setFamilyStatus(adminStatus)
        setHonoraryMembers(adminStatus.honorary_members || [])
      }

      // Get leaderboard
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('royal_family_leaderboard')
        .select('*')
        .limit(20)

      let currentLeaderboard = []
      if (leaderboardError) {
        console.warn('Leaderboard not available yet:', leaderboardError)
      } else {
        currentLeaderboard = leaderboardData || []
        setLeaderboard(currentLeaderboard)
      }

      // Fetch created_at for all relevant users
      const userIds = new Set<string>()
      if (adminStatus?.current_wife?.user_id) userIds.add(adminStatus.current_wife.user_id)
      if (adminStatus?.current_husband?.user_id) userIds.add(adminStatus.current_husband.user_id)
      currentLeaderboard.forEach((entry: LeaderboardEntry) => userIds.add(entry.user_id))
      
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, created_at')
          .in('id', Array.from(userIds))
        
        if (profiles) {
          const ageMap: Record<string, string> = {}
          profiles.forEach(p => {
            if (p.created_at) ageMap[p.id] = p.created_at
          })
          setUsersCreatedAt(ageMap)
        }
      }

    } catch (error) {
      console.error('Error loading family data:', error)
      toast.error('Failed to load family data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFamilyData()
  }, [loadFamilyData])

  const addHonoraryMember = async () => {
    if (!newMemberUsername.trim()) {
      toast.error('Please enter a username')
      return
    }

    try {
      // Find user by username
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', newMemberUsername.trim())
        .single()

      if (userError || !userData) {
        toast.error('User not found')
        return
      }

      // Add honorary member
      const { data, error } = await supabase.rpc('manage_honorary_family_member', {
        p_user_id: userData.id,
        p_admin_id: familyStatus?.admin_id,
        p_action: 'add',
        p_title: newMemberTitle
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Honorary member added successfully')
        setShowAddMember(false)
        setNewMemberUsername('')
        setNewMemberTitle('Honorary Family Member')
        loadFamilyData()
      } else {
        toast.error(data?.error || 'Failed to add member')
      }
    } catch (error: any) {
      console.error('Error adding honorary member:', error)
      toast.error(error.message || 'Failed to add member')
    }
  }

  const removeHonoraryMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this honorary member?')) return

    try {
      const { data, error } = await supabase.rpc('manage_honorary_family_member', {
        p_user_id: userId,
        p_admin_id: familyStatus?.admin_id,
        p_action: 'remove'
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Honorary member removed successfully')
        loadFamilyData()
      } else {
        toast.error(data?.error || 'Failed to remove member')
      }
    } catch (error: any) {
      console.error('Error removing honorary member:', error)
      toast.error(error.message || 'Failed to remove member')
    }
  }

  const updateMemberTitle = async (userId: string, newTitle: string) => {
    try {
      const { data, error } = await supabase.rpc('manage_honorary_family_member', {
        p_user_id: userId,
        p_admin_id: familyStatus?.admin_id,
        p_action: 'update_title',
        p_title: newTitle
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Member title updated successfully')
        loadFamilyData()
      } else {
        toast.error(data?.error || 'Failed to update title')
      }
    } catch (error: any) {
      console.error('Error updating member title:', error)
      toast.error(error.message || 'Failed to update title')
    }
  }

  const getProgressToNext = (currentCoins: number, threshold: number = 50000) => {
    const progress = Math.min((currentCoins / threshold) * 100, 100)
    const remaining = Math.max(threshold - currentCoins, 0)
    return { progress, remaining }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-700 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-700 rounded"></div>
              <div className="h-64 bg-gray-700 rounded"></div>
            </div>
          </div>
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
            <Crown className="w-8 h-8 text-yellow-400" />
            Troll Family Royal Court
          </h1>
          <p className="text-gray-400">Manage the royal family hierarchy and honorary members</p>
        </div>

        {/* Current Royal Family */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Wife/Husband */}
          <div className="bg-zinc-900 rounded-xl border border-purple-500/30 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              Current Royal Consort
            </h2>

            {familyStatus?.current_wife ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-400">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${familyStatus.current_wife.username}`}
                      alt={familyStatus.current_wife.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-yellow-400">
                      Admin&apos;s Wife
                    </h3>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">@</span>
                      <UserNameWithAge
                        user={{
                          username: familyStatus.current_wife.username,
                          id: familyStatus.current_wife.user_id,
                          created_at: usersCreatedAt[familyStatus.current_wife.user_id]
                        }}
                        className="text-white font-semibold"
                      />
                    </div>
                    <p className="text-sm text-gray-400">
                      {familyStatus.current_wife.total_coins?.toLocaleString()} family tokens gifted
                    </p>
                    <p className="text-xs text-gray-500">
                      {familyStatus.current_wife.duration_days || 0} days holding title
                    </p>
                  </div>
                </div>
              </div>
            ) : familyStatus?.current_husband ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-400">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${familyStatus.current_husband.username}`}
                      alt={familyStatus.current_husband.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-yellow-400">
                      Admin&apos;s Husband
                    </h3>
                    <p className="text-white font-semibold">@{familyStatus.current_husband.username}</p>
                    <p className="text-sm text-gray-400">
                      {familyStatus.current_husband.total_coins?.toLocaleString()} family tokens gifted
                    </p>
                    <p className="text-xs text-gray-500">
                      {familyStatus.current_husband.duration_days || 0} days holding title
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Crown className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No royal consort currently</p>
                <p className="text-sm">First to gift 50,000+ family tokens becomes the consort</p>
              </div>
            )}
          </div>

          {/* Progress to Next Contender */}
          <div className="bg-zinc-900 rounded-xl border border-blue-500/30 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Next Contender Progress
            </h2>

            {leaderboard.length > 0 && (
              <div className="space-y-4">
                {leaderboard.slice(0, 3).map((entry, index) => {
                  const { progress, remaining } = getProgressToNext(entry.total_coins)
                  const isCurrentConsort = (
                    (familyStatus?.current_wife?.user_id === entry.user_id) ||
                    (familyStatus?.current_husband?.user_id === entry.user_id)
                  )

                  return (
                    <div key={entry.user_id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            index === 0 ? 'text-yellow-400' :
                            index === 1 ? 'text-gray-400' :
                            'text-orange-400'
                          }`}>
                            #{entry.rank}
                          </span>
                          <span className="font-semibold">@{entry.username}</span>
                          {isCurrentConsort && (
                            <Crown className="w-4 h-4 text-yellow-400" />
                          )}
                        </div>
                        <span className="text-sm text-gray-400">
                          {entry.total_coins.toLocaleString()} family tokens
                        </span>
                      </div>

                      {!isCurrentConsort && (
                        <div className="space-y-1">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400">
                            {remaining.toLocaleString()} family tokens to qualify
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Gift Leaderboard */}
        <div className="bg-zinc-900 rounded-xl border border-green-500/30 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-green-400" />
            Royal Family Gift Leaderboard
          </h2>

          <div className="space-y-3">
            {leaderboard.map((entry, index) => {
              const isConsort = (
                (familyStatus?.current_wife?.user_id === entry.user_id) ||
                (familyStatus?.current_husband?.user_id === entry.user_id)
              )

              return (
                <div key={entry.user_id} className={`flex items-center justify-between p-3 rounded-lg ${
                  isConsort ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-[#1A1A1A]'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-500 text-white' :
                      index === 2 ? 'bg-orange-500 text-white' :
                      'bg-gray-700 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">@</span>
                        <UserNameWithAge
                          user={{
                            username: entry.username,
                            id: entry.user_id,
                            created_at: usersCreatedAt[entry.user_id],
                            age_days: entry.age_days
                          }}
                          className="font-semibold"
                        />
                        {isConsort && <Crown className="w-4 h-4 text-yellow-400" />}
                      </div>
                      <div className="text-sm text-gray-400">
                        {entry.total_coins.toLocaleString()} family tokens • {entry.gender}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">
                      Last gift: {new Date(entry.last_gift_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Honorary Family Members */}
        <div className="bg-zinc-900 rounded-xl border border-purple-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Honorary Family Members
            </h2>
            <button
              onClick={() => setShowAddMember(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Member
            </button>
          </div>

          <div className="space-y-3">
            {honoraryMembers.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.username}`}
                      alt={member.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <UserNameWithAge
                        user={{
                          username: member.username,
                          id: member.user_id,
                          age_days: member.age_days
                        }}
                        className="font-semibold"
                      />
                      <Star className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-sm text-gray-400">{member.title}</div>
                    <div className="text-xs text-gray-500">
                      Added {new Date(member.assigned_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newTitle = prompt('Enter new title:', member.title)
                      if (newTitle && newTitle !== member.title) {
                        updateMemberTitle(member.user_id, newTitle)
                      }
                    }}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                    title="Edit title"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeHonoraryMember(member.user_id)}
                    className="p-2 hover:bg-red-600/20 text-red-400 hover:text-red-300 rounded transition-colors"
                    title="Remove member"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {honoraryMembers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No honorary family members yet</p>
                <p className="text-sm">Add special members to the royal court</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Member Modal */}
        {showAddMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0A0A14] rounded-xl border border-purple-500/30 p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Add Honorary Family Member</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={newMemberUsername}
                    onChange={(e) => setNewMemberUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="Enter username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newMemberTitle}
                    onChange={(e) => setNewMemberTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="Honorary Family Member"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAddMember(false)
                      setNewMemberUsername('')
                      setNewMemberTitle('Honorary Family Member')
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addHonoraryMember}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    Add Member
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
