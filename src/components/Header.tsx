import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Bell, LogOut, Store, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase, searchUsers } from '../lib/supabase'
import { toast } from 'sonner'
import UserNameWithAge from './UserNameWithAge'
import ProfileDropdown from './ui/ProfileDropdown'
import PresidentialToolsModal from './PresidentialToolsModal';
import { TMButton } from './trollmatch/TMButton';

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
    <header className="h-[72px] bg-[#0c101f]/80 backdrop-blur-2xl border-b border-white/[0.06] flex items-center justify-between px-4 md:px-8 sticky top-0 z-50">
      {/* Left: Search Bar */}
      <div className="flex-none z-10">
        <RGBSearchBar />
      </div>

      {/* Center: Global Ticker - Show on all screen sizes */}
      <div className="flex-1 mx-2 md:mx-6 z-10 overflow-hidden">
        <GlobalTicker />
      </div>

      {/* Right: Icons and User Menu */}
      <div className="flex-none relative z-10 flex items-center space-x-5">
        {!user && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/auth?mode=login')}
              className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors duration-200"
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/auth?mode=signup')}
              className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.2)] hover:shadow-[0_0_30px_rgba(147,51,234,0.35)] transition-all duration-300 hover:scale-[1.03] active:scale-95 text-white"
            >
              Sign Up
            </button>
          </div>
        )}

        {user && <PresidentialToolsModal />}

        {/* TM Button - Troll Match */}
        {user && <TMButton />}

        <button
          onClick={async () => {
            if (user && unreadNotifications > 0) {
              setUnreadNotifications(0)
              try {
                await supabase.rpc('mark_all_notifications_read', { p_user_id: user.id })
              } catch (err) {
                console.error('Error marking notifications as read:', err)
              }
            }
            navigate(user ? '/trollifications' : '/auth?mode=signup')
          }}
          className="relative p-2.5 text-slate-400 hover:text-purple-300 transition-all duration-200 hover:bg-white/[0.04] rounded-xl"
        >
          <Bell className="w-5 h-5" />
          {user && unreadNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center bg-red-500 text-white font-bold shadow-[0_0_8px_rgba(239,68,68,0.4)]">
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
                className="p-2.5 text-red-400/70 hover:text-red-300 transition-all duration-200 hover:bg-red-500/[0.06] rounded-xl"
                title="Logout"
                type="button"
              >
                <LogOut className="w-5 h-5" />
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
