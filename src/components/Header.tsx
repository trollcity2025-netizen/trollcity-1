import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Bell, LogOut, Store } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase, searchUsers } from '../lib/supabase'
import { toast } from 'sonner'
import ClickableUsername from './ClickableUsername'
import ProfileDropdown from './ui/ProfileDropdown'

const Header = () => {
  const { user, profile } = useAuthStore()
  // const [notifications, setNotifications] = useState<any[]>([])
  // const [showNotifications, setShowNotifications] = useState(false)
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = React.useState('')

  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    const runSearch = async () => {
      if (!searchQuery.trim()) {
        const data = await searchUsers({ query: '', limit: 50 })
        setSearchResults(data || [])
        setShowUserDropdown(true)
        return
      }

      const query = searchQuery.trim().replace('@', '')

      try {
        if (query.length < 3) {
          setSearchResults([])
          setShowUserDropdown(false)
          return
        }
        const data = await searchUsers({ query, limit: 20 })
        setSearchResults(data || [])
        setShowUserDropdown(true)
      } catch (err) {
        console.error('Search error:', err)
        setSearchResults([])
      }
    }

    const timeoutId = setTimeout(runSearch, 300)
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

      try {
        const data = await searchUsers({ query, limit: 1, select: 'id, username' })
        if (!data || data.length === 0) {
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
      // Check for active session first
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const hasSession = !!sessionData?.session
        if (hasSession) {
          const { error } = await supabase.auth.signOut()
          if (error) console.warn('supabase.signOut returned error:', error)
        } else {
          console.debug('No active session; skipping supabase.auth.signOut()')
        }
      } catch (innerErr: any) {
        console.warn('Error checking/signing out session (ignored):', innerErr?.message || innerErr)
      }

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

  const _handleProfileClick = () => {
    if (profile?.username) {
      navigate(`/profile/${profile.username}`)
    } else {
      navigate('/profile/setup')
    }
  }

  return (
    <header className="h-20 bg-troll-dark-bg/80 border-b border-troll-neon-pink/20 flex items-center justify-between px-8 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-troll-neon-pink/5 via-transparent to-troll-neon-green/5 pointer-events-none"></div>
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
            placeholder="Search users..."
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
                    profile={user}
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
        
        <div className="hidden md:block">
          <ProfileDropdown />
        </div>

        <Link
          to="/store"
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg shadow-yellow-500/20 active:scale-95 transition-all duration-300"
        >
          <Store className="w-5 h-5" />
        </Link>

        <button
          onClick={handleLogout}
          className="p-3 text-red-400 hover:text-red-300 transition-all duration-300 hover:bg-red-500/10 rounded-xl hidden md:block"
          title="Logout"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </header>
  )
}

export default React.memo(Header)
