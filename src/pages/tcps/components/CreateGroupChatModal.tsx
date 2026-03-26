import { useState, useCallback, useEffect } from 'react'
import { X, Search, Users, Check } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'

interface CreateGroupChatModalProps {
  isOpen: boolean
  onClose: () => void
  onGroupCreated: (conversationId: string) => void
}

export default function CreateGroupChatModal({ isOpen, onClose, onGroupCreated }: CreateGroupChatModalProps) {
  const { user, profile } = useAuthStore()
  const [step, setStep] = useState<'select' | 'name'>('select')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<any[]>([])
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep('select')
      setSearchQuery('')
      setSearchResults([])
      setSelectedUsers([])
      setGroupName('')
    }
  }, [isOpen])

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, created_at')
        .ilike('username', `%${query}%`)
        .neq('id', user?.id)
        .limit(15)

      // Filter out already selected users
      const selectedIds = new Set(selectedUsers.map(u => u.id))
      setSearchResults((data || []).filter(u => !selectedIds.has(u.id)))
    } catch (err) {
      console.error('Error searching users:', err)
    } finally {
      setSearching(false)
    }
  }, [user?.id, selectedUsers])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  const toggleUser = (userObj: any) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === userObj.id)
      if (exists) return prev.filter(u => u.id !== userObj.id)
      return [...prev, userObj]
    })
  }

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name')
      return
    }
    if (selectedUsers.length < 1) {
      toast.error('Select at least 1 person')
      return
    }

    setLoading(true)
    try {
      const { createGroupChat } = await import('../../../lib/supabase')
      const conv = await createGroupChat(groupName, selectedUsers.map(u => u.id))
      toast.success('Group chat created!')
      onGroupCreated(conv.id)
      onClose()
    } catch (err: any) {
      console.error('Error creating group chat:', err)
      toast.error(err.message || 'Failed to create group chat')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#14141F] rounded-2xl border border-purple-500/20 shadow-[0_0_30px_rgba(147,51,234,0.15)] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">
              {step === 'select' ? 'New Group Chat' : 'Name Your Group'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {step === 'select' ? (
          <>
            {/* Selected users chips */}
            {selectedUsers.length > 0 && (
              <div className="p-3 border-b border-purple-500/10 flex flex-wrap gap-2">
                {selectedUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-1.5 bg-purple-600/20 border border-purple-500/30 rounded-full pl-1 pr-2 py-0.5">
                    <img
                      src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                      alt={u.username}
                      className="w-5 h-5 rounded-full"
                    />
                    <span className="text-xs text-white font-medium">{u.username}</span>
                    <button onClick={() => removeUser(u.id)} className="text-gray-400 hover:text-white ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
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

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2">
              {searching ? (
                <div className="flex justify-center p-4">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map(u => {
                    const isSelected = selectedUsers.some(s => s.id === u.id)
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleUser(u)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                          isSelected ? 'bg-purple-600/20 border border-purple-500/30' : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <img
                          src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                          alt={u.username}
                          className="w-10 h-10 rounded-full border border-purple-500/20"
                        />
                        <span className="flex-1 font-medium text-white text-sm">{u.username}</span>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : searchQuery ? (
                <div className="text-center p-8 text-gray-500 text-sm">No users found</div>
              ) : (
                <div className="text-center p-8 text-gray-500 text-sm">Search for users to add to your group</div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-purple-500/20">
              <button
                onClick={() => {
                  if (selectedUsers.length < 1) {
                    toast.error('Select at least 1 person')
                    return
                  }
                  setStep('name')
                }}
                disabled={selectedUsers.length < 1}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Continue {selectedUsers.length > 0 ? `(${selectedUsers.length} selected)` : ''}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Name step */}
            <div className="flex-1 p-6 flex flex-col gap-6">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Users className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-sm text-gray-400">
                  {selectedUsers.length + 1} members
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full bg-[#0A0A14] border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  autoFocus
                  maxLength={50}
                />
                <p className="text-[10px] text-zinc-600 mt-1">{groupName.length}/50</p>
              </div>

              {/* Selected members preview */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Members</label>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-1.5 bg-white/5 rounded-full pl-1 pr-3 py-1">
                      <img
                        src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                        alt={u.username}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="text-xs text-gray-300">{u.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-purple-500/20 flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !groupName.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Create Group'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
