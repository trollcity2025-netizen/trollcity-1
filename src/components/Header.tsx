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

import RGBSearchBar from './header/RGBSearchBar';
import GlobalTicker from './header/GlobalTicker';

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
      (payload) => {
        // Update event - need to check if we should decrement
        // Supabase provides both old and new in the payload
        const oldNotif = payload.old as any;
        const newNotif = payload.new as any;
        
        // Check if notification was previously unread and is now read or dismissed
        const wasUnread = !oldNotif?.is_read && !oldNotif?.is_dismissed;
        const isNowReadOrDismissed = newNotif.is_read || newNotif.is_dismissed;
        
        if (wasUnread && isNowReadOrDismissed) {
          setUnreadNotifications(prev => Math.max(0, prev - 1));
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
      (payload) => {
        // Delete event - need to check if the deleted notification was unread
        const deletedNotif = payload.old as any;
        
        // Only decrement if the deleted notification was unread and not dismissed
        if (deletedNotif && !deletedNotif.is_read && !deletedNotif.is_dismissed) {
          setUnreadNotifications(prev => Math.max(0, prev - 1));
        }

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
    <header className="h-20 bg-troll-dark-bg/80 border-b border-troll-neon-pink/20 flex items-center justify-between px-4 md:px-8 backdrop-blur-lg sticky top-0 z-50">
      <div className="absolute inset-0 bg-gradient-to-r from-troll-neon-pink/5 via-transparent to-troll-neon-green/5 pointer-events-none"></div>

      {/* Left: Search Bar */}
      <div className="flex-none z-10">
        <RGBSearchBar />
      </div>

      {/* Center: Global Ticker */}
      <div className="flex-1 hidden md:block mx-4 z-10 overflow-hidden">
        <GlobalTicker />
      </div>

      {/* Right: Icons and User Menu */}
      <div className="flex-none relative z-10 flex items-center space-x-6">
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

        <button
          onClick={async () => {
            if (user && unreadNotifications > 0) {
              // Clear local count immediately
              setUnreadNotifications(0)
              // Mark all notifications as read in the background
              try {
                await supabase.rpc('mark_all_notifications_read', { p_user_id: user.id })
              } catch (err) {
                console.error('Error marking notifications as read:', err)
              }
            }
            navigate(user ? '/trollifications' : '/auth?mode=signup')
          }}
          className="relative p-3 text-purple-400 hover:text-purple-300 transition-all duration-300 group"
        >
          <Bell className="w-6 h-6" />
          {user && unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 text-xs px-2 py-1 rounded-full min-w-[20px] text-center bg-red-500 text-white animate-pulse">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>

        {user && (
          <>
            <div className="hidden md:block">
              <ProfileDropdown />
            </div>
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
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/80 text-white border border-white/10 shadow-lg active:scale-95 transition-all duration-300"
              aria-label="Toggle menu"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
          </>
        )}
      </div>
    </header>
  )
}

export default React.memo(Header)
