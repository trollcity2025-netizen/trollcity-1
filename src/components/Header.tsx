import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Bell, LogOut, Store, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase, searchUsers } from '../lib/supabase'
import { toast } from 'sonner'
import UserNameWithAge from './UserNameWithAge'
import ProfileDropdown from './ui/ProfileDropdown'
import PresidentialToolsModal from './PresidentialToolsModal'

const Header = () => {
  const { user, profile } = useAuthStore()
  // const [notifications, setNotifications] = useState<any[]>([])
  // const [showNotifications, setShowNotifications] = useState(false)
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  // Load all users on component mount - REMOVED for performance
  // We will search dynamically instead

  // Search/filter logic
  useEffect(() => {
    const runSearch = async () => {
      const query = searchQuery.trim().replace('@', '').toLowerCase()

      // If no search query, show nothing or recent
      if (!query) {
        setSearchResults([])
        return
      }

      if (query.length < 2) return // Wait for 2 chars

      try {
          // Search by first 4 characters of username
          const searchQuery = query.substring(0, 4).toLowerCase()
        
          const { data } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url, rgb_username_expires_at, created_at')
            .ilike('username', `${searchQuery}%`)
            .limit(20)
            .order('created_at', { ascending: false })
          
          if (data) {
              setSearchResults(data)
          }
      } catch (err) {
          console.error('Search error:', err)
      }
    }

    const debounce = setTimeout(runSearch, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  // Load notifications
  useEffect(() => {
    if (!user?.id) return

    const loadNotifications = async () => {
      try {
        // Auto-delete notifications older than 30 DAYS (not 30 seconds)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', user.id)
          .lt('created_at', thirtyDaysAgo)

        // Use direct query with count for accurate number (excluding dismissed)
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
          .eq('is_dismissed', false)

        if (error) {
          console.warn('Error loading notifications:', error)
          setUnreadNotifications(0)
          return
        }

        if (count !== null) {
          setUnreadNotifications(count)
        }
      } catch (err) {
        console.warn('Error loading notification count (non-critical):', err)
        setUnreadNotifications(0) // Set to 0 instead of failing
      }
    }

    loadNotifications()

    // Real-time notification listener
    const channel = supabase
      .channel(`notifications-${user.id}`)
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
          // Only count if not already read
          if (!newNotif.is_read) {
            const actionUrl = newNotif.metadata?.action_url
            const toastAction = actionUrl ? {
              label: 'View',
              onClick: () => navigate(actionUrl)
            } : undefined

            // Show toast notification
            if (newNotif.priority === 'high' || newNotif.priority === 'critical') {
              toast.error(newNotif.title || 'High Alert', {
                description: newNotif.message,
                duration: 8000,
                className: 'bg-red-950 border-red-500 text-white',
                action: toastAction
              })
            } else {
              toast(newNotif.title || 'New notification', {
                description: newNotif.message,
                duration: 5000,
                action: toastAction
              })
            }
            setUnreadNotifications((prev) => Math.max(0, prev + 1))
          }
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
          const oldNotif = payload.old as any
          
          const wasUnread = !oldNotif.is_read
          const isUnread = !updatedNotif.is_read
          const wasDismissed = !!oldNotif.is_dismissed
          const isDismissed = !!updatedNotif.is_dismissed
          
          const wasCounted = wasUnread && !wasDismissed
          const isCounted = isUnread && !isDismissed
          
          if (wasCounted && !isCounted) {
            setUnreadNotifications((prev) => Math.max(0, prev - 1))
          } else if (!wasCounted && isCounted) {
            setUnreadNotifications((prev) => prev + 1)
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
        async (payload) => {
          const deletedNotif = payload.old as any
          // Only decrement if it was unread
          if (!deletedNotif.is_read) {
            setUnreadNotifications((prev) => Math.max(0, prev - 1))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, navigate])

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
      // 1. Sign out from Supabase first
      try {
        const { error } = await supabase.auth.signOut()
        if (error) console.warn('supabase.signOut returned error:', error)
      } catch (innerErr: any) {
        console.warn('Error signing out session (ignored):', innerErr?.message || innerErr)
      }

      // 2. Clear store state (awaiting to ensure it finishes)
      await useAuthStore.getState().logout()

      // 3. Clear client storage
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
      navigate('/exit', { replace: true })
    } catch (error: any) {
      console.error('Logout error:', error)
      toast.error(error?.message || 'Error logging out')
      // Force navigation anyway
      navigate('/exit', { replace: true })
    }
  }

  const handleClearCacheReload = async () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch (e) {
      console.warn('Error clearing storage:', e)
    }

    try {
      if (window.indexedDB) {
        const dbs = await window.indexedDB.databases()
        dbs.forEach((db: any) => {
          if (db.name) window.indexedDB.deleteDatabase(db.name)
        })
      }
    } catch (e) {
      console.warn('Error clearing IndexedDB:', e)
    }

    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((name) => caches.delete(name)))
      }
    } catch (e) {
      console.warn('Error clearing caches:', e)
    }

    window.location.reload()
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
            onFocus={() => {
              setIsSearchFocused(true)
              setShowUserDropdown(true)
            }}
            onBlur={() => {
              setIsSearchFocused(false)
              setTimeout(() => setShowUserDropdown(false), 200)
            }}
            onKeyDown={handleSearch}
            placeholder="Search users..."
            autoComplete="off"
            className="w-full pl-12 pr-6 py-3 bg-troll-dark-card/50 border border-troll-neon-pink/30 rounded-xl text-white placeholder-troll-neon-blue/50 focus:outline-none focus:ring-2 focus:ring-troll-neon-pink focus:border-troll-neon-pink transition-all duration-300 shadow-lg focus:shadow-troll-neon-pink/30"
          />
          {isSearchFocused && showUserDropdown && (
            <div className="absolute top-full mt-2 w-full bg-slate-950 border border-purple-600 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-4 text-purple-300 text-center">No users found</div>
              ) : (
                <div>
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => {
                        navigate(`/profile/${user.username}`)
                        setSearchQuery('')
                        setShowUserDropdown(false)
                      }}
                      className="p-3 hover:bg-purple-600/20 cursor-pointer flex items-center gap-3 border-b border-purple-500/20 last:border-b-0"
                    >
                      <img
                        src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                        alt={user.username}
                        className="w-10 h-10 rounded-full border border-purple-500"
                      />
                      <UserNameWithAge
                        user={{
                          username: user.username,
                          id: user.id,
                          created_at: user.created_at,
                          rgb_username_expires_at: user.rgb_username_expires_at
                        }}
                        className="text-white hover:text-purple-400"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 flex items-center space-x-6">
        <PresidentialToolsModal />
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

        <button
          onClick={handleClearCacheReload}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/15 text-cyan-200 border border-cyan-400/30 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all duration-300"
          title="Clear cache and hard reload"
          type="button"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
        
        <div className="hidden md:block">
          <ProfileDropdown />
        </div>

        <Link
          to="/store"
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg shadow-yellow-500/20 active:scale-95 transition-all duration-300"
        >
          <Store className="w-5 h-5" />
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={handleClearCacheReload}
            className="px-3 py-2 text-xs font-semibold text-cyan-200/90 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg border border-cyan-400/20"
            title="Clear cache and hard reload"
            type="button"
          >
            Clear cache
          </button>
          <button
            onClick={handleLogout}
            className="p-3 text-red-400 hover:text-red-300 transition-all duration-300 hover:bg-red-500/10 rounded-xl"
            title="Logout"
            type="button"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>
    </header>
  )
}

export default React.memo(Header)
