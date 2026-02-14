import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Bell, LogOut, Store, ArrowLeft } from 'lucide-react'
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
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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

  useEffect(() => {
    if (!user) return

    const fetchNotifications = async () => {
      try {
        const { data: count, error } = await supabase.rpc('get_unread_notification_count', { 
          p_user_id: user.id 
        });
        
        if (!error && typeof count === 'number') {
          setUnreadNotifications(count)
        } else {
          // Fallback to direct query if RPC fails
          const { count: fallbackCount, error: fallbackError } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false)
            .or('is_dismissed.is.null,is_dismissed.eq.false');
            
          if (!fallbackError && fallbackCount !== null) {
            setUnreadNotifications(fallbackCount)
          }
        }
      } catch (err) {
        console.error('Error fetching notification count:', err);
      }
    }

    fetchNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel(`header-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // New notification - increment count immediately
          const newNotif = payload.new as any;
          if (!newNotif.is_read && !newNotif.is_dismissed) {
            setUnreadNotifications(prev => prev + 1);
          }
          // Also fetch to ensure sync
          fetchNotifications();
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
      (_payload) => {
        // Update event - fetch to get accurate count
        fetchNotifications();
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
      (_payload) => {
        // Delete event - decrement count immediately
          setUnreadNotifications(prev => Math.max(0, prev - 1));
          // Also fetch to ensure sync
          fetchNotifications();
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

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

  const _handleProfileClick = () => {
    if (profile?.username) {
      navigate(`/profile/${profile.username}`)
    } else {
      navigate('/profile/setup')
    }
  }

  return (
    <header className="h-20 bg-troll-dark-bg/80 border-b border-troll-neon-pink/20 flex items-center justify-between px-4 md:px-8 backdrop-blur-lg relative z-50">
      <div className="absolute inset-0 bg-gradient-to-r from-troll-neon-pink/5 via-transparent to-troll-neon-green/5 pointer-events-none"></div>
      <div className="relative z-10 flex items-center space-x-2 md:space-x-6 flex-1">
        <button
          onClick={() => navigate(-1)}
          className="md:hidden p-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft size={24} />
        </button>
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
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent onBlur from firing
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
                          rgb_username_expires_at: user.rgb_username_expires_at,
                          glowing_username_color: user.glowing_username_color
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
        {!user && (
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/auth?mode=login')}
              className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
            >
              Log In
            </button>
            <button 
              onClick={() => navigate('/auth?mode=signup')}
              className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 rounded-lg shadow-lg shadow-purple-500/20 transition-all hover:scale-105 active:scale-95"
            >
              Sign Up
            </button>
          </div>
        )}

        {user && <PresidentialToolsModal />}

        <Link
          to={user ? "/trollifications" : "/auth?mode=signup"}
          className="relative p-3 text-purple-400 hover:text-purple-300 transition-all duration-300 group"
        >
          <Bell className="w-6 h-6" />
          {user && unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 text-xs px-2 py-1 rounded-full min-w-[20px] text-center bg-red-500 text-white">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </Link>

        {user && (
          <>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/80 text-white border border-white/10 shadow-lg active:scale-95 transition-all duration-300"
              aria-label="Toggle menu"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
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
                onClick={handleLogout}
                className="p-3 text-red-400 hover:text-red-300 transition-all duration-300 hover:bg-red-500/10 rounded-xl"
                title="Logout"
                type="button"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

export default React.memo(Header)
