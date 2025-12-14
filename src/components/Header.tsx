import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, User, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { getTierFromXP } from '../lib/tierSystem'
import ClickableUsername from './ClickableUsername'

const Header = () => {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = React.useState('')

  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        // Show all users if query is empty
        const { data } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .limit(50)
          .order('created_at', { ascending: false })
        setSearchResults(data || [])
        setShowUserDropdown(true)
        return
      }

      const query = searchQuery.trim().replace('@', '')
      const searchQuery4 = query.substring(0, 4).toLowerCase()

      try {
        // Search by first 4 characters
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .ilike('username', `${searchQuery4}%`)
          .limit(20)
          .order('created_at', { ascending: false })

        if (error) throw error
        setSearchResults(data || [])
        setShowUserDropdown(true)
      } catch (err) {
        console.error('Search error:', err)
        setSearchResults([])
      }
    }

    const timeoutId = setTimeout(searchUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Load notifications
  useEffect(() => {
    if (!user?.id) return

    const loadNotifications = async () => {
      try {
        // Try RPC function first, but fallback to direct query if it doesn't exist
        try {
          const { data: count, error: rpcError } = await supabase
            .rpc('get_unread_notification_count', { p_user_id: user.id })
           
          if (!rpcError && count !== null && count !== undefined) {
            setUnreadNotifications(Number(count) || 0)
            return // Success, exit early
          }
        } catch (rpcErr: any) {
          // RPC function might not exist, fallback to direct query
          console.warn('RPC function not available, using direct query:', rpcErr)
        }
        
        // Fallback to direct query
        const { data, error: queryError } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_read', false)
        
        if (queryError) {
          console.warn('Error loading notifications (non-critical):', queryError)
          setUnreadNotifications(0)
          return
        }
        
        if (data) {
          setUnreadNotifications(data.length)
        }
      } catch (err) {
        console.warn('Error loading notification count (non-critical):', err)
        setUnreadNotifications(0) // Set to 0 instead of failing
      }
    }

    loadNotifications()

    // Real-time notification listener
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          const newNotif = payload.new as any
          // Show toast notification
          toast(newNotif.title || 'New notification', {
            description: newNotif.message,
            duration: 5000
          })
          setUnreadNotifications((prev) => prev + 1)
        }
      )
      .on(
        'postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        },
        async (payload) => {
          const updatedNotif = payload.new as any
          // If notification was marked as read, reload count
          if (updatedNotif.is_read === true) {
            loadNotifications()
          }
        }
      )
      .on(
        'postgres_changes', 
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        },
        async () => {
          // Reload notification count when one is deleted
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = searchQuery.trim().replace('@', '')
      const searchQuery4 = query.substring(0, 4).toLowerCase()

      try {
        // Search by first 4 characters
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username')
          .ilike('username', `${searchQuery4}%`)
          .limit(1)

        if (error || !data || data.length === 0) {
          toast.error('User not found')
          return
        }

        // Navigate to first match
        navigate(`/profile/${data[0].username}`)
        setSearchQuery('')
        setShowUserDropdown(false)
      } catch (err) {
        console.error('Search error:', err)
        toast.error('Search failed')
      }
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      useAuthStore.getState().logout()

      // Clear client storage
      try {
        localStorage.clear()
        sessionStorage.clear()
        if (window.indexedDB) {
          const dbs = await window.indexedDB.databases()
          dbs.forEach((db: any) => {
            if (db.name) window.indexedDB.deleteDatabase(db.name)
          })
        }
      } catch (e) {
        console.error('Error clearing storage:', e)
      }

      toast.success('Logged out successfully')
    } catch (error: any) {
      console.error('Logout error:', error)
      toast.error(error?.message || 'Error logging out')
    } finally {
      navigate('/auth', { replace: true })
    }
  }

  const profileLink = useMemo(() => {
    if (profile?.username) {
      return `/profile/${profile.username}`
    }
    return '/profile/setup'
  }, [profile?.username])

  

  return (
    <header className="h-20 bg-troll-dark-bg/80 border-b border-troll-neon-pink/20 flex items-center justify-between px-8 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-troll-neon-pink/5 via-transparent to-troll-neon-green/5"></div>
      <div className="relative z-10 flex items-center space-x-6 flex-1">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400 z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowUserDropdown(true)
            }}
            onFocus={() => setShowUserDropdown(true)}
            onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
            onKeyDown={handleSearch}
            placeholder="Search users (first 4 chars)..."
            autoComplete="off"
            className="w-full pl-12 pr-6 py-3 bg-troll-dark-card/50 border border-troll-neon-pink/30 rounded-xl text-white placeholder-troll-neon-blue/50 focus:outline-none focus:ring-2 focus:ring-troll-neon-pink focus:border-troll-neon-pink transition-all duration-300 shadow-lg focus:shadow-troll-neon-pink/30"
          />
          {showUserDropdown && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-[#1A1A1A] border border-purple-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => {
                    navigate(`/profile/${user.username}`)
                    setSearchQuery('')
                    setShowUserDropdown(false)
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
          )}
        </div>
      </div>

      <div className="relative z-10 flex items-center space-x-6">
        <Link
          to="/trollifications"
          className="relative p-3 text-purple-400 hover:text-purple-300 transition-all duration-300 group"
        >
          <Bell className="w-6 h-6" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 text-xs px-2 py-1 rounded-full min-w-[20px] text-center bg-red-500 text-white">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </Link>
        
        <Link 
          to={profile?.username ? `/profile/${profile.username}` : '/profile/me'}
          className={`p-3 text-green-400 hover:text-green-300 transition-all duration-300 group ${!profile?.username ? 'cursor-not-allowed opacity-50' : ''}`}
          onClick={(e) => {
            // allow navigation even if username not set (routes handle 'me')
          }}
        >
          <User className="w-6 h-6" />
        </Link>

        <div className="flex items-center space-x-4">
          <Link 
            to={profileLink}
            className={`flex items-center space-x-4 hover:scale-105 transition-transform duration-300`}
          >
            <div className="text-right">
              <p className="text-sm font-bold text-white">
                {profile?.username || 'Set up profile'}
              </p>
              <p className="text-xs text-troll-neon-blue/70 capitalize font-semibold">
                {profile?.username ? (profile?.tier || getTierFromXP(profile?.xp || 0).title) : 'Set up profile'}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-troll-neon-gold to-troll-neon-orange rounded-full flex items-center justify-center shadow-lg shadow-troll-neon-gold/50 border-2 border-troll-neon-gold/50 overflow-hidden">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to initial if image fails to load
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <span className={`text-troll-dark-bg font-bold text-lg ${profile?.avatar_url ? 'hidden' : ''}`}>
                {profile?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-bold bg-gradient-to-r from-troll-neon-pink to-troll-neon-purple hover:from-troll-neon-pink/80 hover:to-troll-neon-purple/80 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-troll-neon-pink/50 hover:scale-105"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}

export default React.memo(Header)
