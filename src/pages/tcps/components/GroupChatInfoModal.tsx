import { useState, useEffect, useCallback } from 'react'
import { X, Users, LogOut, Crown, Shield, UserPlus, UserMinus, Search } from 'lucide-react'
import { getGroupChatMembers, leaveGroupChat, removeGroupMember, addGroupMember, supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'

interface GroupChatInfoModalProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string
  groupName: string
  onLeftGroup: () => void
  onMemberChanged?: () => void
}

export default function GroupChatInfoModal({ isOpen, onClose, conversationId, groupName, onLeftGroup, onMemberChanged }: GroupChatInfoModalProps) {
  const { user } = useAuthStore()
  const [members, setMembers] = useState<Array<{ user_id: string; username: string; avatar_url: string | null; role: string; status: string }>>([])
  const [loading, setLoading] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [view, setView] = useState<'members' | 'add'>('members')
  const [myRole, setMyRole] = useState<string>('member')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !conversationId) return
    setView('members')
    setSearchQuery('')
    setSearchResults([])

    const load = async () => {
      setLoading(true)
      try {
        const data = await getGroupChatMembers(conversationId)
        setMembers(data)
        const me = data.find(m => m.user_id === user?.id)
        setMyRole(me?.role || 'member')
      } catch (err) {
        console.error('Error loading group members:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, conversationId, user?.id])

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const existingIds = members.map(m => m.user_id)
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query}%`)
        .limit(10)

      setSearchResults((data || []).filter(u => !existingIds.includes(u.id)))
    } catch (err) {
      console.error('Error searching users:', err)
    } finally {
      setSearching(false)
    }
  }, [members])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  const handleAddMember = async (userId: string) => {
    try {
      await addGroupMember(conversationId, userId)
      const data = await getGroupChatMembers(conversationId)
      setMembers(data)
      setSearchQuery('')
      setSearchResults([])
      toast.success('Member added')
      onMemberChanged?.()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member')
    }
  }

  const handleRemoveMember = async (userId: string, username: string) => {
    if (!confirm(`Remove ${username} from this group?`)) return
    setRemovingId(userId)
    try {
      await removeGroupMember(conversationId, userId)
      setMembers(prev => prev.filter(m => m.user_id !== userId))
      toast.success(`${username} removed`)
      onMemberChanged?.()
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member')
    } finally {
      setRemovingId(null)
    }
  }

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this group? This cannot be undone.')) return
    setLeaving(true)
    try {
      await leaveGroupChat(conversationId)
      toast.success('You left the group')
      onLeftGroup()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave group')
    } finally {
      setLeaving(false)
    }
  }

  if (!isOpen) return null

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingMembers = members.filter(m => m.status === 'invited')
  const canManage = myRole === 'owner' || myRole === 'admin'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#14141F] rounded-2xl border border-purple-500/20 shadow-[0_0_30px_rgba(147,51,234,0.15)] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white truncate">{groupName}</h2>
          </div>
          <div className="flex items-center gap-1">
            {canManage && (
              <button
                onClick={() => setView(view === 'add' ? 'members' : 'add')}
                className={`p-1.5 rounded-lg transition-colors ${view === 'add' ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/10 text-gray-400'}`}
                title="Add member"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {view === 'add' ? (
          <>
            {/* Add member search */}
            <div className="p-4 border-b border-purple-500/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users to add..."
                  className="w-full bg-[#0A0A14] border border-purple-500/30 rounded-lg pl-9 pr-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {searching ? (
                <div className="flex justify-center p-4">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                      <img
                        src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                        alt={u.username}
                        className="w-10 h-10 rounded-full border border-purple-500/20"
                      />
                      <span className="flex-1 font-medium text-white text-sm">{u.username}</span>
                      <button
                        onClick={() => handleAddMember(u.id)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center p-8 text-gray-500 text-sm">No users found</div>
              ) : (
                <div className="text-center p-8 text-gray-500 text-sm">Search for users to add</div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Members list */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex justify-center p-8">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active members */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Members ({activeMembers.length})
                    </h3>
                    <div className="space-y-1">
                      {activeMembers.map(m => (
                        <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group">
                          <img
                            src={m.avatar_url || `https://ui-avatars.com/api/?name=${m.username}&background=random`}
                            alt={m.username}
                            className="w-10 h-10 rounded-full border border-purple-500/20"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-sm truncate">
                                {m.username}
                                {m.user_id === user?.id && <span className="text-gray-500 ml-1">(you)</span>}
                              </span>
                              {m.role === 'owner' && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              {m.role === 'admin' && <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                            </div>
                            <span className="text-[10px] text-gray-500 capitalize">{m.role}</span>
                          </div>
                          {canManage && m.user_id !== user?.id && m.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(m.user_id, m.username)}
                              disabled={removingId === m.user_id}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                              title="Remove from group"
                            >
                              {removingId === m.user_id ? (
                                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <UserMinus className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pending invites */}
                  {pendingMembers.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Pending ({pendingMembers.length})
                      </h3>
                      <div className="space-y-1">
                        {pendingMembers.map(m => (
                          <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-xl opacity-60">
                            <img
                              src={m.avatar_url || `https://ui-avatars.com/api/?name=${m.username}&background=random`}
                              alt={m.username}
                              className="w-10 h-10 rounded-full border border-yellow-500/20"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-white text-sm truncate">{m.username}</span>
                              <span className="text-[10px] text-yellow-500 block">Invited</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Leave group */}
            <div className="p-4 border-t border-purple-500/20">
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {leaving ? (
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogOut size={16} />
                    Leave Group
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
