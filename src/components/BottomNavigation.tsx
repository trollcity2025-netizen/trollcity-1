import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, MessageSquare, Video, User, Shield, Gavel, Star, DollarSign, Users, AlertTriangle, Ban, Settings, Heart, LogOut, FileText, ShoppingBag, Briefcase, Banknote, Camera, Mic, Menu, X, LogIn, UserPlus, Trash2 } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface RecentMessage {
  id: string
  sender_id: string
  sender_username: string
  sender_avatar_url: string | null
  content: string
  conversation_id: string
  created_at: string
}

export default function BottomNavigation() {
  const { user, profile, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [tcpsUnreadCount, setTcpsUnreadCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)
  const totalUnreadCount = tcpsUnreadCount + notificationCount
  
  // Bubble visibility state - always visible by default
  const [isBubbleVisible, setIsBubbleVisible] = useState(true)
  
  // Remove zone state
  const [showRemoveZone, setShowRemoveZone] = useState(false)
  const [isOverRemoveZone, setIsOverRemoveZone] = useState(false)
  
  // Mobile message bubble state - only show most recent
  const [recentMessage, setRecentMessage] = useState<RecentMessage | null>(null)
  const [showMessageBubble, setShowMessageBubble] = useState(false)
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Position state for draggable bubble
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 })
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false)

  // Handle keyboard shortcut 'b' to reopen bubble
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if 'b' is pressed and not in an input field
      if (e.key === 'b' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        setIsBubbleVisible(true)
        toast.success('Navigation bubble restored', { duration: 2000 })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('no-scroll')
    } else {
      document.body.classList.remove('no-scroll')
    }
    return () => {
      document.body.classList.remove('no-scroll')
    }
  }, [isMenuOpen])

  // Fetch TCPS unread count - with debounce to prevent excessive requests
  useEffect(() => {
    if (!user?.id) return
    
    let isMounted = true
    let lastFetchTime = 0
    const MIN_FETCH_INTERVAL = 5000 // Only fetch every 5 seconds max
    
    const fetchUnreadCount = async () => {
      const now = Date.now()
      if (now - lastFetchTime < MIN_FETCH_INTERVAL) return
      if (!isMounted) return
      
      lastFetchTime = now
      
      const { data } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
      
      if (!isMounted) return
      
      if (!data || data.length === 0) {
        setTcpsUnreadCount(0)
        return
      }
      const convIds = data.map(d => d.conversation_id)
      
      // Batch count queries to avoid URL length limits
      const BATCH_SIZE = 50
      let totalCount = 0
      
      for (let i = 0; i < convIds.length; i += BATCH_SIZE) {
        const batch = convIds.slice(i, i + BATCH_SIZE)
        const { count } = await supabase
          .from('conversation_messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', batch)
          .neq('sender_id', user.id)
          .is('read_at', null)
        
        totalCount += count || 0
      }
      
      if (isMounted) {
        setTcpsUnreadCount(totalCount)
      }
    }
    
    fetchUnreadCount()
    
    // Build filter for only the user's conversations
    const fetchUserConvs = async () => {
      const { data } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
      return data?.map(d => d.conversation_id) || []
    }
    
    // Subscribe only to the user's conversation messages
    const setupSubscription = async () => {
      const userConvIds = await fetchUserConvs()
      if (!isMounted || userConvIds.length === 0) return
      
      const channel = supabase
        .channel('nav-unread-count')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: `conversation_id=in.(${userConvIds.join(',')})` }, 
          () => { fetchUnreadCount() }
        )
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'conversation_messages', filter: `conversation_id=in.(${userConvIds.join(',')})` }, 
          () => { fetchUnreadCount() }
        )
        .subscribe()
      
      return channel
    }
    
    const channelPromise = setupSubscription()
    
    return () => {
      isMounted = false
      channelPromise.then(channel => {
        if (channel) supabase.removeChannel(channel)
      })
    }
  }, [user?.id])

  // Fetch notification count
  useEffect(() => {
    if (!user?.id) return
    
    const fetchNotificationCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .is('is_dismissed', null)
      
      setNotificationCount(count || 0)
    }
    
    fetchNotificationCount()
    
    const channel = supabase
      .channel('nav-notification-count')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchNotificationCount()
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchNotificationCount()
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Subscribe to new messages for mobile bubble notification
  useEffect(() => {
    if (!user?.id) return

    const subscribeToMessages = async () => {
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) return

      const conversationIds = memberships.map(m => m.conversation_id)

      const channel = supabase
        .channel('mobile-message-bubble')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversation_messages'
          },
          async (payload) => {
            const newMsg = payload.new as any
            
            if (newMsg.sender_id === user.id) return
            if (!conversationIds.includes(newMsg.conversation_id)) return

            const { data: sender } = await supabase
              .from('user_profiles')
              .select('username, avatar_url')
              .eq('id', newMsg.sender_id)
              .single()

            if (messageTimeoutRef.current) {
              clearTimeout(messageTimeoutRef.current)
            }

            setRecentMessage({
              id: newMsg.id,
              sender_id: newMsg.sender_id,
              sender_username: sender?.username || 'Unknown',
              sender_avatar_url: sender?.avatar_url || null,
              content: newMsg.body,
              conversation_id: newMsg.conversation_id,
              created_at: newMsg.created_at
            })
            setShowMessageBubble(true)

            messageTimeoutRef.current = setTimeout(() => {
              setShowMessageBubble(false)
            }, 8000)
          }
        )
        .subscribe()

      return channel
    }

    let channel: any
    subscribeToMessages().then(ch => { channel = ch })

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
    }
  }, [user?.id])

  const handleMessageBubbleClick = () => {
    if (recentMessage) {
      navigate(`/tcps?user=${recentMessage.sender_id}`)
      setShowMessageBubble(false)
    }
  }

  const dismissMessageBubble = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMessageBubble(false)
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
    }
  }

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  // Handle marking messages/notifications as read
  const handleMessagesClick = async () => {
    // Mark all notifications as read
    if (user?.id && notificationCount > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)
    }
    
    // Clear local counts immediately for better UX
    setNotificationCount(0)
    setTcpsUnreadCount(0)
    setIsMenuOpen(false)
  }

  const handleLogout = async () => {
    try {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) console.warn('supabase.signOut returned error:', error)
      } catch (e) {
        console.warn('Error signing out session:', e)
      }

      await logout()

      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch (e) {
        console.error('Error clearing storage:', e)
      }

      toast.success('Logged out successfully')
      setIsMenuOpen(false)
      navigate('/exit', { replace: true })
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error logging out')
      navigate('/exit', { replace: true })
    }
  }

  // Handle drag - show remove zone when dragging near bottom
  const handleDrag = useCallback((_: any, info: any) => {
    const windowHeight = window.innerHeight
    const bubbleY = info.point.y
    
    // Show remove zone when within 150px of bottom
    if (bubbleY > windowHeight - 150) {
      setShowRemoveZone(true)
      // Check if over the middle bottom area (remove zone)
      const windowWidth = window.innerWidth
      const bubbleX = info.point.x
      const isInCenter = bubbleX > windowWidth * 0.3 && bubbleX < windowWidth * 0.7
      setIsOverRemoveZone(isInCenter)
    } else {
      setShowRemoveZone(false)
      setIsOverRemoveZone(false)
    }
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback((_: any, info: any) => {
    setIsDragging(false)
    setShowRemoveZone(false)
    
    // If dropped in remove zone, hide the bubble
    if (isOverRemoveZone) {
      setIsBubbleVisible(false)
      toast.success('Navigation hidden. Press "B" to restore', { duration: 3000 })
      setIsOverRemoveZone(false)
      return
    }
    
    setBubblePosition({ 
      x: info.point.x - window.innerWidth + 70, 
      y: info.point.y - window.innerHeight + 70 
    })
  }, [isOverRemoveZone])

  // Determine Role
  const role = profile?.role || 'viewer'

  // Get role display name and icon
  const getRoleInfo = () => {
    switch (role as string) {
      case 'admin':
        return { label: 'Admin', icon: Shield, color: 'from-red-500 to-orange-500' }
      case 'broadcaster':
        return { label: 'Broadcaster', icon: Video, color: 'from-purple-500 to-blue-500' }
      case 'officer':
        return { label: 'Officer', icon: Gavel, color: 'from-blue-500 to-cyan-500' }
      case 'vip':
        return { label: 'VIP', icon: Star, color: 'from-yellow-500 to-amber-500' }
      default:
        return { label: 'Menu', icon: Menu, color: 'from-purple-600 to-blue-600' }
    }
  }

  const roleInfo = getRoleInfo()

  // Menu Options based on role
  const getMenuOptions = () => {
    const baseOptions = [
      { category: 'Navigation', label: 'Home', icon: Home, path: '/' },
      { category: 'Navigation', label: 'Live Streams', icon: Video, path: '/live' },
      { category: 'Navigation', label: 'Messages', icon: MessageSquare, path: '/tcps', badge: totalUnreadCount, onClick: handleMessagesClick },
      { category: 'Navigation', label: 'My Profile', icon: User, path: `/profile/${profile?.username || profile?.id}` },
    ]

    switch (role as string) {
      case 'broadcaster':
        return [
          ...baseOptions,
          // Streaming
          { category: 'Streaming', label: 'Start Stream', icon: Video, path: '/broadcast/setup' },
          { category: 'Streaming', label: 'Stream Summary', icon: FileText, path: '/broadcast/summary' },
          { category: 'Streaming', label: 'My Guests', icon: Users, path: '/guests' },
          // Finance
          { category: 'Finance', label: 'My Earnings', icon: DollarSign, path: '/earnings' },
          { category: 'Finance', label: 'Wallet', icon: Banknote, path: '/wallet' },
          // Community
          { category: 'Community', label: 'Creator Dashboard', icon: Star, path: '/creator/dashboard' },
          // Store
          { category: 'Store', label: 'Coin Store', icon: ShoppingBag, path: '/store' },
        ]
      case 'admin':
        return [
          ...baseOptions,
          // Streaming
          { category: 'Streaming', label: 'Start Stream', icon: Video, path: '/broadcast/setup' },
          { category: 'Streaming', label: 'Stream Summary', icon: FileText, path: '/broadcast/summary' },
          // Management
          { category: 'Management', label: 'Court', icon: Gavel, path: '/troll-court' },
          { category: 'Management', label: 'Ban Management', icon: Ban, path: '/admin/ban-management' },
          { category: 'Management', label: 'City Control', icon: Shield, path: '/admin/city-control' },
          { category: 'Management', label: 'Safety Center', icon: AlertTriangle, path: '/admin/safety' },
          // Content
          { category: 'Content', label: 'Applications', icon: FileText, path: '/admin/applications' },
          { category: 'Content', label: 'Marketplace', icon: ShoppingBag, path: '/admin/marketplace' },
          { category: 'Content', label: 'Reports', icon: Shield, path: '/admin/officer-reports' },
          { category: 'Content', label: 'Live Dashboard', icon: Video, path: '/admin/live' },
          { category: 'Content', label: 'Stats', icon: Star, path: '/admin/stats' },
          // Finance
          { category: 'Finance', label: 'Earnings', icon: DollarSign, path: '/admin/earnings' },
          { category: 'Finance', label: 'Payments', icon: Banknote, path: '/admin/payments' },
          { category: 'Finance', label: 'Payouts', icon: DollarSign, path: '/admin/payouts' },
          // System
          { category: 'System', label: 'System Tools', icon: Settings, path: '/admin/system/health' },
          { category: 'System', label: 'Policies', icon: FileText, path: '/admin/policies' },
          { category: 'System', label: 'Policies Docs', icon: FileText, path: '/admin/policies-docs' },
        ]
      case 'officer':
        return [
          ...baseOptions,
          { category: 'Moderation', label: 'Mute User', icon: MicOffIcon, path: '/officer/mute' },
          { category: 'Moderation', label: 'Kick User', icon: AlertTriangle, path: '/officer/kick' },
          { category: 'Moderation', label: 'Reports', icon: Shield, path: '/officer/reports' },
          { category: 'Lounge', label: 'Officer Lounge', icon: Briefcase, path: '/officer/lounge' },
          { category: 'Finance', label: 'Payroll', icon: Banknote, path: '/officer/payroll' }
        ]
      case 'viewer':
      default:
        return [
          ...baseOptions,
          // Streaming
          { category: 'Streaming', label: 'Go Live', icon: Video, path: '/broadcast/setup' },
          { category: 'Streaming', label: 'Live Streams', icon: Video, path: '/live' },
          // Store & Economy
          { category: 'Store', label: 'Coin Store', icon: ShoppingBag, path: '/store' },
          { category: 'Store', label: 'Troll Wheel', icon: Star, path: '/troll-wheel' },
          { category: 'Store', label: 'Marketplace', icon: ShoppingBag, path: '/marketplace' },
          // Community
          { category: 'Community', label: 'Troll Pods', icon: Mic, path: '/pods' },
          { category: 'Community', label: 'Leaderboard', icon: Star, path: '/leaderboard' },
          { category: 'Community', label: 'Family Wars', icon: Users, path: '/family-wars' },
          // City
          { category: 'City', label: 'Trolls Town', icon: Home, path: '/trolls-town' },
          { category: 'City', label: 'Explore', icon: Users, path: '/explore' },
          // Support
          { category: 'Support', label: 'Support', icon: Heart, path: '/support' },
          { category: 'Support', label: 'Wallet', icon: Banknote, path: '/wallet' },
        ]
    }
  }

  // Helper for icons not in top import
  const MicOffIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="1" y1="1" x2="23" y2="23"></line>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
  )

  const menuOptions = getMenuOptions()

  return (
    <>
      {/* Full Screen Overlay when menu is open */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[55]"
          />
        )}
      </AnimatePresence>

      {/* Remove Zone - appears when dragging to bottom */}
      <AnimatePresence>
        {showRemoveZone && isDragging && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className={`fixed bottom-0 left-0 right-0 h-32 z-[90] flex items-center justify-center transition-colors ${
              isOverRemoveZone ? 'bg-red-500/40' : 'bg-red-500/20'
            }`}
          >
            <div className={`flex flex-col items-center gap-2 transition-transform ${isOverRemoveZone ? 'scale-110' : 'scale-100'}`}>
              <Trash2 size={32} className={isOverRemoveZone ? 'text-red-300' : 'text-red-400'} />
              <span className={`text-sm font-bold ${isOverRemoveZone ? 'text-red-200' : 'text-red-300'}`}>
                {isOverRemoveZone ? 'Release to Remove' : 'Drag here to hide'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable Floating Menu Bubble - Always Visible */}
      <AnimatePresence>
        {isBubbleVisible && (
          <motion.div
            initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
            animate={{ scale: 1, opacity: 1, x: bubblePosition.x, y: bubblePosition.y }}
            exit={{ scale: 0, opacity: 0 }}
            drag
            dragMomentum={false}
            dragConstraints={{ left: -window.innerWidth + 80, right: 0, top: -window.innerHeight + 150, bottom: 0 }}
            onDragStart={() => setIsDragging(true)}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className="fixed bottom-20 right-4 z-[100]"
            style={{ touchAction: 'none' }}
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setIsMenuOpen(true)}
              className={`w-16 h-16 rounded-full bg-gradient-to-tr ${roleInfo.color} p-[3px] shadow-[0_0_25px_rgba(124,58,237,0.7)]`}
            >
              <div className="w-full h-full rounded-full bg-[#0D0D0D] flex items-center justify-center border border-white/10">
                <roleInfo.icon size={28} className="text-white" />
              </div>
            </motion.button>
            
            {/* Unread indicator bubble */}
            {totalUnreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-[#0D0D0D] animate-pulse">
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </div>
            )}
            
            {/* Drag hint */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 whitespace-nowrap opacity-60">
              Drag to move
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role-Based Menu Popup - Full Screen */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Full Screen Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/95 backdrop-blur-md z-[60]"
            />
            
            {/* Full Screen Menu */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-[70] overflow-y-auto bg-gradient-to-br from-[#0a0a0a] via-[#121212] to-[#0a0a0a]"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-black/50 backdrop-blur-md border-b border-white/10 p-4">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${roleInfo.color} p-[2px]`}>
                      <div className="w-full h-full rounded-full bg-[#0D0D0D] flex items-center justify-center">
                        <roleInfo.icon size={24} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{roleInfo.label}</h3>
                      <p className="text-xs text-gray-400">Tap to navigate</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user && (
                      <button
                        onClick={handleLogout}
                        className="p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors"
                        title="Logout"
                      >
                        <LogOut size={22} />
                      </button>
                    )}
                    <button
                      onClick={() => setIsMenuOpen(false)}
                      className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Menu Content */}
              <div className="p-4 max-w-4xl mx-auto">
                {!user ? (
                  // Guest View
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Link
                        to="/auth"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-4 p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 rounded-2xl border border-purple-500/30 transition-colors group"
                      >
                        <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30 transition-colors">
                          <LogIn size={28} />
                        </div>
                        <div className="flex-1">
                          <span className="text-white font-bold text-lg block">Sign In</span>
                          <span className="text-gray-400 text-sm">Already have an account?</span>
                        </div>
                      </Link>
                      
                      <Link
                        to="/auth?tab=signup"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-4 p-6 bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/30 hover:to-emerald-600/30 rounded-2xl border border-green-500/30 transition-colors group"
                      >
                        <div className="p-3 rounded-xl bg-green-500/20 text-green-400 group-hover:bg-green-500/30 transition-colors">
                          <UserPlus size={28} />
                        </div>
                        <div className="flex-1">
                          <span className="text-white font-bold text-lg block">Sign Up</span>
                          <span className="text-gray-400 text-sm">Create a new account</span>
                        </div>
                      </Link>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 px-1">Browse</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Link
                          to="/live"
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors"
                        >
                          <Video size={24} className="text-purple-400" />
                          <span className="text-white font-medium">Live Streams</span>
                        </Link>
                        <Link
                          to="/"
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors"
                        >
                          <Home size={24} className="text-blue-400" />
                          <span className="text-white font-medium">Home</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Authenticated User View
                  <div className="space-y-6 mt-4">
                    {Object.entries(
                      menuOptions.reduce((acc: any, opt: any) => {
                        const cat = opt.category || 'General'
                        if (!acc[cat]) acc[cat] = []
                        acc[cat].push(opt)
                        return acc
                      }, {})
                    ).map(([category, options]: [string, any]) => (
                      <div key={category}>
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">{category}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {options.map((opt: any, i: number) => {
                            const OptIcon = opt.icon
                            return (
                              <Link
                                key={i}
                                to={opt.path}
                                onClick={() => {
                                  if (opt.onClick) {
                                    opt.onClick()
                                  } else {
                                    setIsMenuOpen(false)
                                  }
                                }}
                                className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors group"
                              >
                                <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30 transition-colors">
                                  <OptIcon size={24} />
                                </div>
                                <span className="text-white font-medium text-base flex-1">{opt.label}</span>
                                {opt.badge > 0 && (
                                  <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full">
                                    {opt.badge > 9 ? '9+' : opt.badge}
                                  </span>
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div className="sticky bottom-0 p-4 text-center">
                <p className="text-xs text-gray-600">
                  Press <kbd className="px-2 py-1 bg-white/10 rounded text-gray-400">B</kbd> to restore navigation bubble
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Message Notification Bubble - Only shows most recent message */}
      <AnimatePresence>
        {showMessageBubble && recentMessage && (
          <motion.div
            initial={{ x: 300, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 300, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-20 right-4 left-4 md:left-auto md:w-80 bg-[#1A1A2E] border border-purple-500/30 rounded-2xl p-4 z-[80] shadow-2xl cursor-pointer"
            onClick={handleMessageBubbleClick}
          >
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <img
                  src={recentMessage.sender_avatar_url || `https://ui-avatars.com/api/?name=${recentMessage.sender_username}&background=random`}
                  alt={recentMessage.sender_username}
                  className="w-12 h-12 rounded-full border-2 border-purple-500/30"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#1A1A2E]" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-white text-sm truncate">
                    {recentMessage.sender_username}
                  </h4>
                  <button
                    onClick={dismissMessageBubble}
                    className="text-gray-400 hover:text-white p-1 -mr-1 -mt-1 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-gray-300 text-sm mt-1 line-clamp-2">
                  {recentMessage.content}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Tap to reply
                </p>
              </div>
            </div>
            
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 8, ease: 'linear' }}
              className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-b-2xl origin-left"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
