import { useState, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import ClickableUsername from '../../../components/ClickableUsername'

interface NewMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectUser: (userId: string) => void
}

export default function NewMessageModal({ isOpen, onClose, onSelectUser }: NewMessageModalProps) {
  const { profile } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && searchQuery.length >= 2) {
      searchUsers()
    } else {
      setUsers([])
    }
    }, [searchQuery, isOpen])

  const searchUsers = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id,username,avatar_url,bio')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', profile?.id)
        .limit(20)

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = (userId: string) => {
    onSelectUser(userId)
    onClose()
    setSearchQuery('')
    setUsers([])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#060011] border-2 border-[#8a2be2] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#8a2be2]/30 bg-[rgba(10,0,30,0.6)] flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">New Message</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[rgba(155,50,255,0.1)] rounded-lg transition"
          >
            <X className="w-5 h-5 text-[#8a2be2]" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#8a2be2]/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#8a2be2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 bg-[rgba(20,0,50,0.6)] border border-[#8a2be2]/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8a2be2]"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Searching...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {searchQuery.length < 2 ? (
                <p>Type at least 2 characters to search</p>
              ) : (
                <p>No users found</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#8a2be2]/20">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectUser(user.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-[rgba(155,50,255,0.1)] transition"
                >
                  <img
                    src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                    alt={user.username}
                    className="w-12 h-12 rounded-full border-2 border-[#8a2be2] hover:border-[#00ffcc] transition"
                  />
                  <div className="flex-1 text-left">
                    <ClickableUsername userId={user.id} username={user.username} />
                    {user.bio && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{user.bio}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

