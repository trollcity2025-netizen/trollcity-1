import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import ClickableUsername from './ClickableUsername'

interface UserSearchDropdownProps {
  query: string
  onSelect: (userId: string, username: string) => void
  onClose: () => void
}

export default function UserSearchDropdown({ query, onSelect, onClose }: UserSearchDropdownProps) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!query || query.length < 1) {
      // If query is empty or too short, show all users (limited)
      loadAllUsers()
      return
    }

    const searchUsers = async () => {
      setLoading(true)
      try {
        // Search by first 4 characters of username
        const searchQuery = query.substring(0, 4).toLowerCase()
        
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .ilike('username', `${searchQuery}%`)
          .limit(20)
          .order('created_at', { ascending: false })

        if (error) throw error
        setUsers(data || [])
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(searchUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [query])

  const loadAllUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .limit(50)
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Load users error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && users.length === 0) {
    return (
      <div className="absolute top-full mt-2 w-full bg-[#1A1A1A] border border-purple-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
        <div className="p-4 text-center text-gray-400">Loading...</div>
      </div>
    )
  }

  if (users.length === 0) {
    return null
  }

  return (
    <div className="absolute top-full mt-2 w-full bg-[#1A1A1A] border border-purple-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
      {users.map((user) => (
        <div
          key={user.id}
          onClick={() => {
            onSelect(user.id, user.username)
            onClose()
            navigate(`/profile/${user.username}`)
          }}
          className="p-3 hover:bg-purple-600/20 cursor-pointer flex items-center gap-3 border-b border-[#2C2C2C] last:border-b-0"
        >
          <img
            src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
            alt={user.username}
            className="w-10 h-10 rounded-full border border-purple-500"
          />
          <ClickableUsername
            username={user.username}
            userId={user.id}
            className="text-white hover:text-purple-400"
          />
        </div>
      ))}
    </div>
  )
}

