import { useState, useEffect, useCallback } from 'react'
import { X, Search } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import UserNameWithAge from '../../../components/UserNameWithAge'

interface NewMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectUser: (userId: string) => void
}

export default function NewMessageModal({ isOpen, onClose, onSelectUser }: NewMessageModalProps) {
  const { user } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [recentUsers, setRecentUsers] = useState<any[]>([])

  useEffect(() => {
    const loadRecentUsers = async () => {
      if (!user?.id) return
      // Fetch users followed or recent interactions could be here
      // For now, let's just fetch some random users or top users
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role, created_at')
        .neq('id', user.id)
        .limit(5)
      
      if (data) setRecentUsers(data)
    }

    if (isOpen) {
      loadRecentUsers()
      setSearchQuery('')
    }
  }, [isOpen, user?.id])

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setLoading(true)
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role, rgb_username_expires_at, created_at')
        .ilike('username', `%${query}%`)
        .neq('id', user?.id)
        .limit(10)

      setSearchResults(data || [])
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#14141F] rounded-2xl border border-purple-500/20 shadow-[0_0_30px_rgba(147,51,234,0.15)] flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New Message</h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 border-b border-purple-500/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a user..."
              className="w-full bg-[#0A0A14] border border-purple-500/30 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-1">
              <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">Search Results</div>
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => onSelectUser(result.id)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors text-left group"
                >
                  <img
                    src={result.avatar_url || `https://ui-avatars.com/api/?name=${result.username}&background=random`}
                    alt={result.username}
                    className="w-10 h-10 rounded-full border border-purple-500/20 group-hover:border-purple-500/50 transition-colors"
                  />
                  <div>
                    <div className="font-medium text-white flex items-center gap-2">
                      <UserNameWithAge 
                        user={{
                          ...result,
                          username: result.username,
                        }}
                        className="pointer-events-none" // Disable link since the whole row is clickable
                        showBadges={true}
                      />
                      {result.role === 'admin' && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                          ADMIN
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="text-center p-8 text-gray-500">
              No users found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">Suggested</div>
              {recentUsers.map((result) => (
                <button
                  key={result.id}
                  onClick={() => onSelectUser(result.id)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors text-left"
                >
                  <img
                    src={result.avatar_url || `https://ui-avatars.com/api/?name=${result.username}&background=random`}
                    alt={result.username}
                    className="w-10 h-10 rounded-full border border-purple-500/20"
                  />
                  <UserNameWithAge 
                    user={{
                        username: result.username,
                        id: result.id,
                        created_at: result.created_at,
                        role: result.role
                    }}
                    className="font-medium text-white pointer-events-none"
                    showBadges={true}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
